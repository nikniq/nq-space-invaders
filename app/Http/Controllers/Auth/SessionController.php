<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\View\View;

/**
 * Sign in with a password, and sign out.
 */
class SessionController extends Controller
{
    /**
     * The sign-in page: Google, an emailed link, or a password.
     */
    public function create(): View
    {
        return view('auth.login');
    }

    /**
     * Accounts without a password cannot pass this check, because a missing
     * hash never matches. They sign in with an email link or Google instead.
     */
    public function store(Request $request): RedirectResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
        ]);

        if (! Auth::attempt($credentials, $request->boolean('remember'))) {
            return back()
                ->withErrors(['password' => 'That email and password do not match. If you have not set a password yet, use an email link or Google.'])
                ->onlyInput('email');
        }

        $request->session()->regenerate();

        return redirect()->intended(route('game'));
    }

    public function destroy(Request $request): RedirectResponse
    {
        Auth::logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('game');
    }
}
