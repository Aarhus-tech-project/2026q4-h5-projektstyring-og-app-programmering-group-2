namespace Server.Exceptions
{
    public class ApiException(string message, int statusCode) : Exception(message)
    {
        public int StatusCode { get; } = statusCode;
    }

    public class InvalidLoginException() : ApiException("Invalid email or password", 401);
    public class BlobUploadInternalServerException() : ApiException("Internal server error", 502);
    public class FailedToCreateInDatabaseException() : ApiException("Failed to create", 500);
    public class VoteAlreadySubmittedException() : ApiException("Vote already submitted", 409);
    public class MatchupDoesntExistException() : ApiException("Matchup doesnt exist", 404);
    public class InvalidVoteException() : ApiException("Voted posts dont match the matchup", 400);
    public class ImageTooLargeException() : ApiException("Image dimensions are too large", 413);
    public class UnsupportedImageException() : ApiException("Unsupported or corrupt image", 400);
    public class NotEnoughPostsException() : ApiException("Not enough posts to create a matchup", 404);
}