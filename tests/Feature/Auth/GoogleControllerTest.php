<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Laravel\Socialite\Contracts\Provider;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\InvalidStateException;
use Laravel\Socialite\Two\User as GoogleUser;
use Mockery\MockInterface;
use Tests\TestCase;

class GoogleControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'services.google.client_id' => 'test-client',
            'services.google.client_secret' => 'test-secret',
        ]);
    }

    public function test_redirect_sends_the_browser_to_google_with_the_configured_client(): void
    {
        $response = $this->get(route('google.redirect'));

        $response->assertRedirect();
        $location = $response->headers->get('Location');
        $this->assertStringStartsWith('https://accounts.google.com/o/oauth2/auth?', $location);
        $this->assertStringContainsString('client_id=test-client', $location);
        $this->assertStringContainsString(urlencode(route('google.callback')), $location);
    }

    public function test_callback_creates_a_verified_account_for_a_new_google_user_and_signs_in(): void
    {
        $this->freezeSecond();
        $this->fakeGoogleUser(id: 'g-123', email: 'Pilot@Example.com', name: 'Ace Pilot', avatar: 'https://lh3.example/avatar.png');

        $response = $this->get(route('google.callback', ['code' => 'abc', 'state' => 'xyz']));

        $response->assertRedirect(route('game'));
        $user = User::firstWhere('email', 'pilot@example.com');
        $this->assertNotNull($user);
        $this->assertSame('Ace Pilot', $user->name);
        $this->assertSame('g-123', $user->google_id);
        $this->assertSame('https://lh3.example/avatar.png', $user->avatar);
        $this->assertTrue($user->email_verified_at->equalTo(now()));
        $this->assertFalse($user->hasPassword());
        $this->assertAuthenticatedAs($user);
    }

    public function test_callback_signs_in_an_account_already_linked_to_that_google_id(): void
    {
        $user = User::factory()->google('g-123')->create(['email' => 'old@example.com']);
        $this->fakeGoogleUser(id: 'g-123', email: 'new@example.com');

        $this->get(route('google.callback', ['code' => 'abc', 'state' => 'xyz']))->assertRedirect(route('game'));

        $this->assertAuthenticatedAs($user);
        $this->assertDatabaseCount('users', 1);
        $this->assertSame('old@example.com', $user->fresh()->email);
    }

    public function test_callback_links_an_existing_email_account_when_google_has_verified_the_address(): void
    {
        $user = User::factory()->withoutPassword()->create(['email' => 'pilot@example.com', 'name' => 'Keep Me']);
        $this->fakeGoogleUser(id: 'g-123', email: 'pilot@example.com', name: 'Google Name');

        $this->get(route('google.callback', ['code' => 'abc', 'state' => 'xyz']))->assertRedirect(route('game'));

        $this->assertAuthenticatedAs($user);
        $user->refresh();
        $this->assertSame('g-123', $user->google_id);
        $this->assertSame('Keep Me', $user->name);
        $this->assertDatabaseCount('users', 1);
    }

    public function test_callback_refuses_an_unverified_google_email_so_accounts_cannot_be_taken_over(): void
    {
        User::factory()->create(['email' => 'victim@example.com']);
        $this->fakeGoogleUser(id: 'g-attacker', email: 'victim@example.com', emailVerified: false);

        $response = $this->get(route('google.callback', ['code' => 'abc', 'state' => 'xyz']));

        $response->assertRedirect(route('login'));
        $response->assertSessionHasErrors('google');
        $this->assertGuest();
        $this->assertNull(User::firstWhere('email', 'victim@example.com')->google_id);
    }

    public function test_callback_handles_a_cancelled_sign_in(): void
    {
        $response = $this->get(route('google.callback', ['error' => 'access_denied']));

        $response->assertRedirect(route('login'));
        $response->assertSessionHasErrors(['google' => 'Google sign-in was cancelled.']);
        $this->assertGuest();
    }

    public function test_callback_handles_a_state_mismatch(): void
    {
        Socialite::shouldReceive('driver')->with('google')->andReturn(
            $this->mock(Provider::class, fn (MockInterface $m) => $m->shouldReceive('user')->andThrow(new InvalidStateException))
        );

        $response = $this->get(route('google.callback', ['code' => 'abc', 'state' => 'bad']));

        $response->assertRedirect(route('login'));
        $response->assertSessionHasErrors(['google' => 'Google sign-in was interrupted. Please try again.']);
        $this->assertGuest();
    }

    public function test_signed_in_users_are_sent_to_the_game_from_the_google_routes(): void
    {
        $this->actingAs(User::factory()->create())->get(route('google.redirect'))->assertRedirect('/');
    }

    /**
     * Stand in for Google's response: Socialite's HTTP exchange is the one
     * piece that leaves the process.
     */
    private function fakeGoogleUser(string $id, string $email, string $name = 'Pilot', ?string $avatar = null, bool $emailVerified = true): void
    {
        $googleUser = (new GoogleUser)->setRaw(['email_verified' => $emailVerified])->map([
            'id' => $id,
            'email' => $email,
            'name' => $name,
            'avatar' => $avatar,
        ]);

        Socialite::shouldReceive('driver')->with('google')->andReturn(
            $this->mock(Provider::class, fn (MockInterface $m) => $m->shouldReceive('user')->andReturn($googleUser))
        );
    }
}
