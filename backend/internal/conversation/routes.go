package conversation

import "github.com/gin-gonic/gin"

func ConversationRoutes(router *gin.RouterGroup, handler *Handler, authMiddleware gin.HandlerFunc) {
	conversations := router.Group("/conversations")
	conversations.Use(authMiddleware)
	{
		conversations.GET("", handler.List)
		conversations.GET("/", handler.List)
		conversations.GET("/with/:userId", handler.GetOrCreateWith)
		conversations.GET("/:id", handler.Get)
	}
}