<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Notifications\EmailSignInLink;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;
use Illuminate\View\View;

/**
 * Passwordless sign-up and sign-in. A player submits an email address and
 * receives a signed, single-use link. An account is created only when the
 * link is confirmed, so registration always follows email validation.
 */
class EmailLinkController extends Controller
{
    public const EXPIRES_IN_MINUTES = 60;

    /**
     * Email a sign-in link. The response is the same whether or not the
     * address already has an account, so the form cannot be used to discover
     * which addresses are registered.
     */
    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'string', 'email', 'max:255'],
            'name' => ['nullable', 'string', 'max:50'],
        ]);

        $email = Str::lower($validated['email']);
        $nonce = Str::random(40);
        $expiresAt = now()->addMinutes(self::EXPIRES_IN_MINUTES);

        Cache::put($this->nonceKey($nonce), true, $expiresAt);

        $url = URL::temporarySignedRoute('email-link.show', $expiresAt, array_filter([
            'email' => $email,
            'name' => isset($validated['name']) ? trim($validated['name']) : null,
            'nonce' => $nonce,
        ]));

        Notification::route('mail', $email)->notify(new EmailSignInLink(
            $url,
            isNewAccount: ! User::where('email', $email)->exists(),
            expiresInMinutes: self::EXPIRES_IN_MINUTES,
        ));

        return redirect()->route('email-link.sent')->with('email', $email);
    }

    /**
     * "Check your inbox" page shown after a link is sent.
     */
    public function sent(Request $request): View|RedirectResponse
    {
        if (! $request->session()->has('email')) {
            return redirect()->route('login');
        }

        return view('auth.email-link-sent', ['email' => $request->session()->get('email')]);
    }

    /**
     * Landing page for the emailed link. It asks for a click instead of
     * signing in straight away, because mail scanners open links on their own
     * and would otherwise use up the single-use link.
     */
    public function show(Request $request): View
    {
        return view('auth.email-link-confirm', [
            'email' => $request->query('email'),
            'isNewAccount' => ! User::where('email', $request->query('email'))->exists(),
        ]);
    }

    /**
     * Use the link: create the account if the address is new, mark the email
     * as verified, and sign the player in.
     */
    public function confirm(Request $request): RedirectResponse
    {
        if (! Cache::pull($this->nonceKey((string) $request->query('nonce')))) {
            return redirect()->route('login')->withErrors([
                'email' => 'That link has already been used or has expired. Request a new one below.',
            ]);
        }

        $email = Str::lower((string) $request->query('email'));

        $user = User::firstWhere('email', $email) ?? User::create([
            'name' => $request->query('name') ?: Str::limit(Str::before($email, '@'), 50, ''),
            'email' => $email,
        ]);

        if ($user->email_verified_at === null) {
            $user->forceFill(['email_verified_at' => now()])->save();
        }

        Auth::login($user, remember: true);
        $request->session()->regenerate();

        if (! $user->hasPassword()) {
            return redirect()->route('password.edit')
                ->with('status', 'Your email is confirmed and you are signed in. Set a password now, or skip this and keep using email links.');
        }

        return redirect()->intended(route('game'));
    }

    private function nonceKey(string $nonce): string
    {
        return 'email-link:'.$nonce;
    }
}
