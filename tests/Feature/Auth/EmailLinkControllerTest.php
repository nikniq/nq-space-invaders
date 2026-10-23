<?php

namespace Tests\Feature\Auth;

use App\Http\Controllers\Auth\EmailLinkController;
use App\Models\User;
use App\Notifications\EmailSignInLink;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;
use Tests\TestCase;

class EmailLinkControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_requesting_a_link_for_a_new_address_emails_a_registration_link_without_creating_an_account(): void
    {
        Notification::fake();

        $response = $this->post(route('email-link.store'), ['email' => 'New.Pilot@Example.com', 'name' => 'Ace']);

        $response->assertRedirect(route('email-link.sent'));
        $response->assertSessionHas('email', 'new.pilot@example.com');
        $this->assertDatabaseCount('users', 0);
        Notification::assertSentOnDemand(EmailSignInLink::class, function (EmailSignInLink $notification, array $channels, AnonymousNotifiable $notifiable) {
            return $notifiable->routes['mail'] === 'new.pilot@example.com'
                && $notification->isNewAccount === true
                && str_contains($notification->url, 'email=new.pilot%40example.com')
                && str_contains($notification->url, 'name=Ace')
                && str_contains($notification->url, 'signature=');
        });
    }

    public function test_requesting_a_link_for_an_existing_address_emails_a_sign_in_link_with_the_same_response(): void
    {
        Notification::fake();
        User::factory()->create(['email' => 'pilot@example.com']);

        $response = $this->post(route('email-link.store'), ['email' => 'pilot@example.com']);

        $response->assertRedirect(route('email-link.sent'));
        Notification::assertSentOnDemand(EmailSignInLink::class, fn (EmailSignInLink $n) => $n->isNewAccount === false);
    }

    public function test_requesting_a_link_rejects_an_invalid_email(): void
    {
        Notification::fake();

        $response = $this->from(route('register'))->post(route('email-link.store'), ['email' => 'not-an-email']);

        $response->assertRedirect(route('register'));
        $response->assertSessionHasErrors(['email' => 'The email field must be a valid email address.']);
        Notification::assertNothingSent();
    }

    public function test_the_fourth_link_request_for_one_address_in_a_minute_is_throttled(): void
    {
        Notification::fake();

        foreach (range(1, 3) as $attempt) {
            $this->post(route('email-link.store'), ['email' => 'pilot@example.com'])->assertRedirect(route('email-link.sent'));
        }
        $response = $this->post(route('email-link.store'), ['email' => 'pilot@example.com']);

        $response->assertTooManyRequests();
        Notification::assertCount(3);
    }

    public function test_the_sent_page_shows_the_address_the_link_went_to(): void
    {
        $this->withSession(['email' => 'pilot@example.com'])->get(route('email-link.sent'))
            ->assertOk()
            ->assertSee('pilot@example.com');
    }

    public function test_the_sent_page_redirects_to_login_when_no_link_was_requested(): void
    {
        $this->get(route('email-link.sent'))->assertRedirect(route('login'));
    }

    public function test_opening_a_fresh_link_shows_a_confirm_page_instead_of_signing_in(): void
    {
        $url = $this->requestLink('pilot@example.com');

        $response = $this->get($url);

        $response->assertOk();
        $response->assertSee('Create my account');
        $response->assertSee('pilot@example.com');
        $this->assertGuest();
        $this->assertDatabaseCount('users', 0);
    }

    public function test_confirming_a_link_for_a_new_address_creates_a_verified_account_signs_in_and_offers_a_password(): void
    {
        $this->freezeSecond();
        $url = $this->requestLink('pilot@example.com', 'Ace');

        $response = $this->post($url);

        $response->assertRedirect(route('password.edit'));
        $response->assertSessionHas('status');
        $user = User::firstWhere('email', 'pilot@example.com');
        $this->assertNotNull($user);
        $this->assertSame('Ace', $user->name);
        $this->assertTrue($user->email_verified_at->equalTo(now()));
        $this->assertFalse($user->hasPassword());
        $this->assertAuthenticatedAs($user);
    }

    public function test_confirming_a_link_without_a_name_derives_one_from_the_address(): void
    {
        $url = $this->requestLink('ace.pilot@example.com');

        $this->post($url);

        $this->assertSame('ace.pilot', User::firstWhere('email', 'ace.pilot@example.com')->name);
    }

    public function test_confirming_a_link_for_an_existing_account_with_a_password_signs_in_and_returns_to_the_game(): void
    {
        $user = User::factory()->create(['email' => 'pilot@example.com']);
        $url = $this->requestLink('pilot@example.com');

        $response = $this->post($url);

        $response->assertRedirect(route('game'));
        $this->assertAuthenticatedAs($user);
        $this->assertDatabaseCount('users', 1);
    }

    public function test_a_link_cannot_be_used_twice(): void
    {
        $url = $this->requestLink('pilot@example.com');
        $this->post($url);
        auth()->logout();

        $response = $this->post($url);

        $response->assertRedirect(route('login'));
        $response->assertSessionHasErrors(['email' => 'That link has already been used or has expired. Request a new one below.']);
        $this->assertGuest();
    }

    public function test_an_expired_link_redirects_to_login_with_a_message(): void
    {
        $url = $this->requestLink('pilot@example.com');

        $this->travel(EmailLinkController::EXPIRES_IN_MINUTES + 1)->minutes();
        $response = $this->get($url);

        $response->assertRedirect(route('login'));
        $response->assertSessionHasErrors(['email' => 'That link has expired or is not valid. Request a new one below.']);
    }

    public function test_a_link_with_a_tampered_email_is_rejected(): void
    {
        $url = $this->requestLink('pilot@example.com');
        $tampered = str_replace('pilot%40example.com', 'victim%40example.com', $url);

        $response = $this->post($tampered);

        $response->assertRedirect(route('login'));
        $this->assertGuest();
        $this->assertDatabaseCount('users', 0);
    }

    public function test_a_link_with_a_forged_signature_is_rejected(): void
    {
        $url = URL::temporarySignedRoute('email-link.show', now()->addHour(), ['email' => 'pilot@example.com', 'nonce' => Str::random(40)]);
        $forged = preg_replace('/signature=\w+/', 'signature='.str_repeat('0', 64), $url);

        $this->post($forged)->assertRedirect(route('login'));
        $this->assertGuest();
    }

    public function test_signed_in_users_are_sent_to_the_game_instead_of_the_link_pages(): void
    {
        $this->actingAs(User::factory()->create())
            ->post(route('email-link.store'), ['email' => 'pilot@example.com'])
            ->assertRedirect('/');
    }

    /**
     * Request a link the way a player would, and return the URL from the email.
     */
    private function requestLink(string $email, ?string $name = null): string
    {
        Notification::fake();
        $this->post(route('email-link.store'), array_filter(['email' => $email, 'name' => $name]));

        $url = null;
        Notification::assertSentOnDemand(EmailSignInLink::class, function (EmailSignInLink $notification) use (&$url) {
            $url = $notification->url;

            return true;
        });

        return $url;
    }
}
