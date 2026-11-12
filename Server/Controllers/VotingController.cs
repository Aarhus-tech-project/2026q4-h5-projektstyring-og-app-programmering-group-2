using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Server.Repositories;

namespace Server.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
[Authorize]
public class VotingController(BlobStorageService storage, VotingRepository votingRepository) : ControllerBase
{
    public record VoteRequest(Guid MatchupId, Guid WinnerPostId, Guid LoserPostId);

    [HttpGet("matchup")]
    public async Task<ActionResult<MatchupDTO>> Matchup()
    {
        var (matchup, postA, postB) = await votingRepository.GetOrCreateMatchup(User.GetUserId());

        return new MatchupDTO(matchup.Id, new PublicPostDTO(postA, storage), new PublicPostDTO(postB, storage), matchup.IssuedAt);
    }

    [HttpPost("vote")]
    public async Task<IActionResult> Vote(VoteRequest voteRequest)
    {
        await votingRepository.SubmitVote(User.GetUserId(), voteRequest);
        return Ok();
    }
}
