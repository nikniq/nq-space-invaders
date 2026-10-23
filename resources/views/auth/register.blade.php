@extends('layouts.auth')

@section('title', 'Create an account')

@section('content')
    <h1>Join the fight</h1>
    <p class="lead">We'll email you a link to confirm your address. Your account is created when you click it, and you can set a password afterwards.</p>

    <x-google-button label="Sign up with Google" />

    <form method="POST" action="{{ route('email-link.store') }}">
        @csrf
        <label for="name">Pilot name <span class="hint">(optional)</span></label>
        <input id="name" type="text" name="name" value="{{ old('name') }}" maxlength="50" autocomplete="nickname">
        @error('name')
            <p class="field-error">{{ $message }}</p>
        @enderror
        <label for="email">Email</label>
        <input id="email" type="email" name="email" value="{{ old('email') }}" autocomplete="email" required>
        @error('email')
            <p class="field-error">{{ $message }}</p>
        @enderror
        <button type="submit" class="btn btn-primary">Email me a link</button>
    </form>
@endsection

@section('footer')
    <a href="{{ route('login') }}">Already signed up? Sign in</a>
@endsection
