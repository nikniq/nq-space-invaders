@extends('layouts.auth')

@section('title', 'Check your inbox')

@section('content')
    <h1>Check your inbox</h1>
    <p class="lead">
        We sent a link to <strong class="email">{{ $email }}</strong>.
        Open it on this device to finish. It works once and expires in {{ \App\Http\Controllers\Auth\EmailLinkController::EXPIRES_IN_MINUTES }} minutes.
    </p>
    <p class="hint">Nothing arrived? Check your spam folder, or <a href="{{ route('login') }}">request another link</a>.</p>
@endsection
