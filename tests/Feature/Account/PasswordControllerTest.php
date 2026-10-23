<?php

namespace Tests\Feature\Account;

use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class PasswordControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_guests_are_redirected_to_login(): void
    {
        $this->get(route('password.edit'))->assertRedirect(route('login'));
        $this->put(route('password.update'), ['password' => 'new-password-123', 'password_confirmation' => 'new-password-123'])
            ->assertRedirect(route('login'));
    }

    public function test_an_account_without_a_password_sets_one_without_a_current_password(): void
    {
        $user = User::factory()->withoutPassword()->create();

        $this->actingAs($user)->get(route('password.edit'))
            ->assertOk()
            ->assertSee('Set a password')
            ->assertSee('Skip for now')
            ->assertDontSee('Current password');

        $response = $this->actingAs($user)->put(route('password.update'), [
            'password' => 'new-password-123',
            'password_confirmation' => 'new-password-123',
        ]);

        $response->assertRedirect(route('game'));
        $response->assertSessionHas('status', 'Password saved. You can now sign in with your email and password too.');
        $this->assertTrue(Hash::check('new-password-123', $user->fresh()->password));
    }

    public function test_changing_a_password_requires_the_current_one(): void
    {
        $user = User::factory()->create(['password' => 'old-password-123']);

        $this->actingAs($user)->get(route('password.edit'))->assertOk()->assertSee('Current password')->assertDontSee('Skip for now');

        $response = $this->actingAs($user)->from(route('password.edit'))->put(route('password.update'), [
            'current_password' => 'wrong',
            'password' => 'new-password-123',
            'password_confirmation' => 'new-password-123',
        ]);

        $response->assertRedirect(route('password.edit'));
        $response->assertSessionHasErrors('current_password');
        $this->assertTrue(Hash::check('old-password-123', $user->fresh()->password));

        $response = $this->actingAs($user)->put(route('password.update'), [
            'current_password' => 'old-password-123',
            'password' => 'new-password-123',
            'password_confirmation' => 'new-password-123',
        ]);

        $response->assertRedirect(route('game'));
        $response->assertSessionHas('status', 'Your password has been changed.');
        $this->assertTrue(Hash::check('new-password-123', $user->fresh()->password));
    }

    public function test_a_short_or_unconfirmed_password_is_rejected(): void
    {
        $user = User::factory()->withoutPassword()->create();

        $this->actingAs($user)->from(route('password.edit'))
            ->put(route('password.update'), ['password' => 'short', 'password_confirmation' => 'short'])
            ->assertSessionHasErrors(['password' => 'The password field must be at least 8 characters.']);

        $this->actingAs($user)->from(route('password.edit'))
            ->put(route('password.update'), ['password' => 'new-password-123', 'password_confirmation' => 'different-123'])
            ->assertSessionHasErrors(['password' => 'The password field confirmation does not match.']);

        $this->assertFalse($user->fresh()->hasPassword());
    }
}
