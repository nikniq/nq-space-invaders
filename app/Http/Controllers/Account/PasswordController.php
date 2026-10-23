<?php

namespace App\Http\Controllers\Account;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rules\Password;
use Illuminate\View\View;

/**
 * Set a password for the first time, or change it. Accounts start without
 * one, so the current password is asked for only once a password exists.
 */
class PasswordController extends Controller
{
    public function edit(Request $request): View
    {
        return view('account.password', ['user' => $request->user()]);
    }

    public function update(Request $request): RedirectResponse
    {
        $user = $request->user();

        $validated = $request->validate(array_filter([
            'current_password' => $user->hasPassword() ? ['required', 'current_password'] : null,
            'password' => ['required', 'confirmed', Password::defaults()],
        ]));

        $hadPassword = $user->hasPassword();
        $user->update(['password' => $validated['password']]);

        return redirect()->route('game')->with('status', $hadPassword
            ? 'Your password has been changed.'
            : 'Password saved. You can now sign in with your email and password too.');
    }
}
