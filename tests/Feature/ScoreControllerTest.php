<?php

namespace Tests\Feature;

use App\Models\Score;
use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class ScoreControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_leaderboard_returns_the_top_ten_highest_first_with_names_but_no_emails(): void
    {
        $ace = User::factory()->create(['name' => 'Ace', 'email' => 'ace@example.com']);
        Score::factory()->for($ace)->create(['score' => 9000, 'wave' => 7]);
        Score::factory()->count(11)->sequence(fn ($s) => ['score' => 100 + $s->index])->create();

        $response = $this->getJson(route('scores.index'));

        $response->assertOk();
        $response->assertJsonCount(10, 'data');
        $response->assertJsonPath('data.0', ['name' => 'Ace', 'score' => 9000, 'wave' => 7, 'difficulty' => 'normal']);
        $response->assertJsonPath('data.1.score', 110);
        $this->assertStringNotContainsString('ace@example.com', $response->getContent());
    }

    public function test_signed_in_player_saves_a_score_and_gets_their_world_rank(): void
    {
        $user = User::factory()->create();
        Score::factory()->create(['score' => 5000]);
        Score::factory()->create(['score' => 100]);

        $response = $this->actingAs($user)->postJson(route('scores.store'), ['score' => 1200, 'wave' => 3, 'difficulty' => 'hard']);

        $response->assertCreated();
        $response->assertExactJson(['rank' => 2, 'best' => 1200]);
        $this->assertDatabaseHas('scores', ['user_id' => $user->id, 'score' => 1200, 'wave' => 3, 'difficulty' => 'hard']);
    }

    public function test_guests_cannot_save_scores(): void
    {
        $response = $this->postJson(route('scores.store'), ['score' => 1200, 'wave' => 3, 'difficulty' => 'normal']);

        $response->assertUnauthorized();
        $this->assertDatabaseCount('scores', 0);
    }

    public function test_impossible_scores_are_rejected(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->postJson(route('scores.store'), ['score' => 99999999, 'wave' => 0, 'difficulty' => 'insane']);

        $response->assertUnprocessable();
        $response->assertJsonValidationErrors(['score', 'wave', 'difficulty']);
        $this->assertDatabaseCount('scores', 0);
    }

    public function test_the_seventh_submission_in_a_minute_is_throttled(): void
    {
        $user = User::factory()->create();

        foreach (range(1, 6) as $game) {
            $this->actingAs($user)->postJson(route('scores.store'), ['score' => $game, 'wave' => 1, 'difficulty' => 'normal'])->assertCreated();
        }
        $response = $this->actingAs($user)->postJson(route('scores.store'), ['score' => 7, 'wave' => 1, 'difficulty' => 'normal']);

        $response->assertTooManyRequests();
        $this->assertDatabaseCount('scores', 6);
    }

    public function test_game_page_tells_the_game_where_to_save_only_for_signed_in_players(): void
    {
        $guestConfig = $this->gameConfig($this->get(route('game')));

        $this->assertNull($guestConfig['player']);
        $this->assertNull($guestConfig['submitUrl']);
        $this->assertSame(route('scores.index'), $guestConfig['scoresUrl']);

        $playerConfig = $this->gameConfig($this->actingAs(User::factory()->create(['name' => 'Ace']))->get(route('game')));

        $this->assertSame(['name' => 'Ace'], $playerConfig['player']);
        $this->assertSame(route('scores.store'), $playerConfig['submitUrl']);
    }

    /**
     * Decode window.GAME_CONFIG, which Js::from() writes as JSON.parse('...').
     *
     * @return array<string, mixed>
     */
    private function gameConfig(TestResponse $response): array
    {
        $response->assertOk();
        preg_match("/window\\.GAME_CONFIG = JSON\\.parse\\('(.*?)'\\);/", $response->getContent(), $match);
        $this->assertNotEmpty($match, 'GAME_CONFIG missing from the page');

        return json_decode(json_decode('"'.$match[1].'"'), true);
    }
}
