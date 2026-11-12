using Microsoft.AspNetCore.Mvc;
using Server.Repositories;

namespace Server.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class RankingController(BlobStorageService storage, RankingRepository rankingRepository) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<RankedPostDTO>>> Ranking([FromQuery] RankingPeriod period = RankingPeriod.All, [FromQuery] RankingOrder order = RankingOrder.Top)
    {
        List<Post> posts = await rankingRepository.GetRanking(period, order);
        Response.Headers.CacheControl = "public, max-age=0, s-maxage=30";
        return posts.Select(p => new RankedPostDTO(p, storage)).ToList();
    }
}
