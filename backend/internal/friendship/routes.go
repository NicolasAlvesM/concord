package friendship

import "github.com/gin-gonic/gin"

func FriendRoutes(router *gin.RouterGroup, handler *Handler, authMiddleware gin.HandlerFunc) {
	friends := router.Group("/friends")
	friends.Use(authMiddleware)
	{
		friends.POST("/request", handler.SendRequest)
		friends.DELETE("/request/:username", handler.CancelRequest)
		friends.GET("", handler.ListFriends)
		friends.GET("/", handler.ListFriends)
		friends.GET("/pending", handler.ListPending)
		friends.PUT("/:username/accept", handler.AcceptRequest)
		friends.PUT("/:username/decline", handler.DeclineRequest)
		friends.DELETE("/:username", handler.RemoveFriend)
	}
}
