<?php

namespace Database\Factories;

use App\Models\Score;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Score>
 */
class ScoreFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'score' => fake()->numberBetween(100, 20000),
            'wave' => fake()->numberBetween(1, 12),
            'difficulty' => 'normal',
        ];
    }
}
