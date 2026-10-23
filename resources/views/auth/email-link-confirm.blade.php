@extends('layouts.auth')

@section('title', $isNewAccount ? 'Confirm your email' : 'Confirm sign-in')

@section('content')
    <h1>{{ $isNewAccount ? 'Confirm your email' : 'Welcome back' }}</h1>
    <p class="lead">
        @if ($isNewAccount)
            Create your account for <strong class="email">{{ $email }}</strong>.
        @else
            Sign in as <strong class="email">{{ $email }}</strong>.
        @endif
    </p>

    {{-- The signed URL is reused as the form action: the signature covers the path and query, not the method. --}}
    <form method="POST" action="{{ request()->fullUrl() }}">
        @csrf
        <button type="submit" class="btn btn-primary">{{ $isNewAccount ? 'Create my account' : 'Sign in' }}</button>
    </form>
@endsection
