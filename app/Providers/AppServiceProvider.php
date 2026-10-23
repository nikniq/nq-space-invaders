<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Keyed on email and IP together, so one network cannot lock out an
        // account and one account cannot be guessed from many networks.
        RateLimiter::for('login', function (Request $request) {
            return Limit::perMinute(5)->by(Str::transliterate(Str::lower($request->string('email')).'|'.$request->ip()));
        });

        // Each link is an email we send. Limit per address so nobody can flood
        // one inbox, and per IP so one client cannot mail many addresses.
        RateLimiter::for('email-link', function (Request $request) {
            return [
                Limit::perMinute(3)->by('email:'.Str::lower($request->string('email'))),
                Limit::perHour(30)->by('ip:'.$request->ip()),
            ];
        });
    }
}
