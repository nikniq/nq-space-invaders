<?php

use App\Http\Controllers\Account\PasswordController;
use App\Http\Controllers\Auth\EmailLinkController;
use App\Http\Controllers\Auth\GoogleController;
use App\Http\Controllers\Auth\RegistrationController;
use App\Http\Controllers\Auth\SessionController;
use App\Http\Controllers\ScoreController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('game');
})->name('game');

Route::get('/scores', [ScoreController::class, 'index'])->name('scores.index');

Route::middleware('guest')->group(function () {
    Route::get('/login', [SessionController::class, 'create'])->name('login');
    Route::post('/login', [SessionController::class, 'store'])->middleware('throttle:login')->name('login.store');

    Route::get('/register', [RegistrationController::class, 'create'])->name('register');

    Route::post('/email-link', [EmailLinkController::class, 'store'])->middleware('throttle:email-link')->name('email-link.store');
    Route::get('/email-link/sent', [EmailLinkController::class, 'sent'])->name('email-link.sent');
    Route::get('/email-link/verify', [EmailLinkController::class, 'show'])->middleware(['signed', 'throttle:20,1'])->name('email-link.show');
    Route::post('/email-link/verify', [EmailLinkController::class, 'confirm'])->middleware(['signed', 'throttle:20,1'])->name('email-link.confirm');

    Route::get('/auth/google', [GoogleController::class, 'redirect'])->name('google.redirect');
    Route::get('/auth/google/callback', [GoogleController::class, 'callback'])->name('google.callback');
});

Route::middleware('auth')->group(function () {
    Route::get('/account/password', [PasswordController::class, 'edit'])->name('password.edit');
    Route::put('/account/password', [PasswordController::class, 'update'])->name('password.update');

    Route::post('/scores', [ScoreController::class, 'store'])->middleware('throttle:scores')->name('scores.store');

    Route::post('/logout', [SessionController::class, 'destroy'])->name('logout');
});
