<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * The emailed link that confirms an address. For a new address it completes
 * registration; for an existing account it signs the player in.
 *
 * Sent synchronously: the app runs without a queue worker, and the sender
 * should learn straight away if delivery fails.
 */
class EmailSignInLink extends Notification
{
    use Queueable;

    public function __construct(
        public string $url,
        public bool $isNewAccount,
        public int $expiresInMinutes,
    ) {}

    /**
     * Get the notification's delivery channels.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    /**
     * Get the mail representation of the notification.
     */
    public function toMail(object $notifiable): MailMessage
    {
        $app = config('app.name');

        if ($this->isNewAccount) {
            return (new MailMessage)
                ->subject("Confirm your email to join {$app}")
                ->line('Click the button below to confirm your email address and create your account.')
                ->action('Confirm email and create account', $this->url)
                ->line("This link works once and expires in {$this->expiresInMinutes} minutes. You can set a password afterwards, or keep signing in with email links.")
                ->line('If you did not ask to join, you can ignore this email and no account will be created.');
        }

        return (new MailMessage)
            ->subject("Your {$app} sign-in link")
            ->line('Click the button below to sign in.')
            ->action('Sign in', $this->url)
            ->line("This link works once and expires in {$this->expiresInMinutes} minutes.")
            ->line('If you did not ask to sign in, you can ignore this email.');
    }
}
