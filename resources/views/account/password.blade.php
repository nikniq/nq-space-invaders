@extends('layouts.auth')

@section('title', $user->hasPassword() ? 'Change password' : 'Set a password')

@section('content')
    <h1>{{ $user->hasPassword() ? 'Change password' : 'Set a password' }}</h1>
    <p class="lead">
        @if ($user->hasPassword())
            Signed in as <strong class="email">{{ $user->email }}</strong>.
        @else
            Optional. With a password you can sign in without waiting for an email.
        @endif
    </p>

    <form method="POST" action="{{ route('password.update') }}">
        @csrf
        @method('PUT')
        <input type="hidden" name="email" value="{{ $user->email }}" autocomplete="username">

        @if ($user->hasPassword())
            <label for="current_password">Current password</label>
            <input id="current_password" type="password" name="current_password" autocomplete="current-password" required>
            @error('current_password')
                <p class="field-error">{{ $message }}</p>
            @enderror
        @endif

        <label for="password">New password</label>
        <input id="password" type="password" name="password" autocomplete="new-password" required>
        @error('password')
            <p class="field-error">{{ $message }}</p>
        @enderror

        <label for="password_confirmation">Repeat new password</label>
        <input id="password_confirmation" type="password" name="password_confirmation" autocomplete="new-password" required>

        <button type="submit" class="btn btn-primary">Save password</button>
    </form>
@endsection

@section('footer')
    @unless ($user->hasPassword())
        <a href="{{ route('game') }}">Skip for now</a>
    @endunless
@endsection
