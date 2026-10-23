<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Tests\TestCase;

class SessionControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_login_page_renders_email_link_and_password_forms(): void
    {
        $response = $this->get(route('login'));

        $response->assertOk();
        $response->assertSee('Email me a sign-in link');
        $response->assertSee('Sign in with a password');
        $response->assertDontSee('Sign in with Google');
    }

    public function test_login_page_offers_google_when_configured(): void
    {
        config(['services.google.client_id' => 'test-client']);

        $this->get(route('login'))->assertSee('Sign in with Google');
    }

    public function test_valid_password_signs_in_and_returns_to_the_game(): void
    {
        $user = User::factory()->create(['password' => 'secret-password']);

        $response = $this->post(route('login.store'), ['email' => $user->email, 'password' => 'secret-password']);

        $response->assertRedirect(route('game'));
        $this->assertAuthenticatedAs($user);
    }

    public function test_wrong_password_returns_an_error_and_keeps_the_email(): void
    {
        $user = User::factory()->create(['password' => 'secret-password']);

        $response = $this->from(route('login'))->post(route('login.store'), ['email' => $user->email, 'password' => 'wrong']);

        $response->assertRedirect(route('login'));
        $response->assertSessionHasErrors('password');
        $response->assertSessionHasInput('email', $user->email);
        $response->assertSessionMissing('_old_input.password');
        $this->assertGuest();
    }

    public function test_an_account_without_a_password_cannot_sign_in_with_one(): void
    {
        $user = User::factory()->withoutPassword()->create();

        $response = $this->from(route('login'))->post(route('login.store'), ['email' => $user->email, 'password' => '']);

        $response->assertSessionHasErrors('password');
        $this->assertGuest();

        $response = $this->from(route('login'))->post(route('login.store'), ['email' => $user->email, 'password' => 'anything']);

        $response->assertSessionHasErrors(['password' => 'That email and password do not match. If you have not set a password yet, use an email link or Google.']);
        $this->assertGuest();
    }

    public function test_sixth_login_attempt_in_a_minute_is_throttled(): void
    {
        $user = User::factory()->create();

        foreach (range(1, 5) as $attempt) {
            $this->post(route('login.store'), ['email' => $user->email, 'password' => 'wrong']);
        }
        $response = $this->post(route('login.store'), ['email' => $user->email, 'password' => 'wrong']);

        $response->assertTooManyRequests();
    }

    public function test_signing_out_ends_the_session_and_returns_to_the_game(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->post(route('logout'));

        $response->assertRedirect(route('game'));
        $this->assertGuest();
    }

    public function test_guests_cannot_sign_out_and_users_cannot_see_the_login_page(): void
    {
        $this->post(route('logout'))->assertRedirect(route('login'));

        $this->actingAs(User::factory()->create())->get(route('login'))->assertRedirect('/');
    }

    public function test_game_page_shows_sign_in_links_to_guests_and_account_links_to_users(): void
    {
        $this->get(route('game'))->assertOk()->assertSee('SIGN IN')->assertSee('CREATE ACCOUNT');

        $user = User::factory()->withoutPassword()->create(['name' => 'Ace']);

        $this->actingAs($user)->get(route('game'))
            ->assertOk()
            ->assertSee('Ace')
            ->assertSee('SET PASSWORD')
            ->assertSee('SIGN OUT')
            ->assertDontSee('CREATE ACCOUNT');
    }
}
