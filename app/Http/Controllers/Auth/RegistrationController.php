<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\View\View;

/**
 * The sign-up page. Submitting it sends an email link (see
 * EmailLinkController); the account is created when that link is confirmed.
 */
class RegistrationController extends Controller
{
    public function create(): View
    {
        return view('auth.register');
    }
}
