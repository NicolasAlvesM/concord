package message

import "github.com/gin-gonic/gin"

func MessageRoutes(router *gin.RouterGroup, handler *Handler, authMiddleware gin.HandlerFunc) {
	channels := router.Group("/channels/:channelId/messages")
	channels.Use(authMiddleware)
	{
		channels.POST("", handler.CreateChannelMessage)
		channels.POST("/", handler.CreateChannelMessage)
		channels.GET("", handler.ListChannelMessages)
		channels.GET("/", handler.ListChannelMessages)
		channels.DELETE("/:messageId", handler.DeleteChannelMessage)
	}

	conversations := router.Group("/conversations/:id/messages")
	conversations.Use(authMiddleware)
	{
		conversations.POST("", handler.CreateConversationMessage)
		conversations.POST("/", handler.CreateConversationMessage)
		conversations.GET("", handler.ListConversationMessages)
		conversations.GET("/", handler.ListConversationMessages)
		conversations.DELETE("/:messageId", handler.DeleteConversationMessage)
	}
}