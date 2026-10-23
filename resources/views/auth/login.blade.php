@extends('layouts.auth')

@section('title', 'Sign in')

@section('content')
    <h1>Sign in</h1>
    <p class="lead">Save your progress and get on the leaderboard.</p>

    <x-google-button label="Sign in with Google" />

    <form method="POST" action="{{ route('email-link.store') }}">
        @csrf
        @error('email')
            <p class="error" role="alert">{{ $message }}</p>
        @enderror
        <label for="link-email">Email me a sign-in link</label>
        <input id="link-email" type="email" name="email" value="{{ old('email') }}" autocomplete="email" required>
        <button type="submit" class="btn btn-primary">Send link</button>
    </form>

    <details @error('password') open @enderror>
        <summary>Sign in with a password</summary>
        <form method="POST" action="{{ route('login.store') }}">
            @csrf
            <label for="email">Email</label>
            <input id="email" type="email" name="email" value="{{ old('email') }}" autocomplete="username" required>
            <label for="password">Password</label>
            <input id="password" type="password" name="password" autocomplete="current-password" required>
            @error('password')
                <p class="field-error">{{ $message }}</p>
            @enderror
            <label class="check"><input type="checkbox" name="remember" value="1"> Keep me signed in</label>
            <button type="submit" class="btn btn-primary">Sign in</button>
        </form>
        <p class="hint">No password yet? Use the email link above. You can set one afterwards.</p>
    </details>
@endsection

@section('footer')
    <a href="{{ route('register') }}">Create an account</a>
@endsection
