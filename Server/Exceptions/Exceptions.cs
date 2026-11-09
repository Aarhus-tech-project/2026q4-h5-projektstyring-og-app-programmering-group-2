namespace Server.Exceptions
{
    public class ApiException(string message, int statusCode, Exception? inner = null) : Exception(message, inner)
    {
        public int StatusCode { get; } = statusCode;
    }

    public class InvalidLoginException() : ApiException("Invalid email or password", 401);
    public class InvalidRefreshTokenException() : ApiException("Invalid or expired refresh token", 401);
    public class EmailAlreadyInUseException() : ApiException("That email is already in use", 409);
    public class BlobUploadInternalServerException(Exception? inner = null) : ApiException("Internal server error", 502, inner);
    public class FailedToCreateInDatabaseException(Exception? inner = null) : ApiException("Failed to create", 500, inner);
    public class VoteAlreadySubmittedException() : ApiException("Vote already submitted", 409);
    public class MatchupDoesntExistException() : ApiException("Matchup doesnt exist", 404);
    public class InvalidVoteException() : ApiException("Voted posts dont match the matchup", 400);
    public class ImageTooLargeException() : ApiException("Image dimensions are too large", 413);
    public class UnsupportedImageException() : ApiException("Unsupported or corrupt image", 400);
    public class NotEnoughPostsException() : ApiException("Not enough posts to create a matchup", 404);
    public class PostDoesntExistException() : ApiException("Post doesnt exist", 404);
}