package auth

import "github.com/gin-gonic/gin"

func AuthRoutes(router *gin.RouterGroup, handler *Handler, authMiddleware gin.HandlerFunc) {
	auth := router.Group("/auth")
	{
		auth.POST("/register", handler.Register)
		auth.POST("/login", handler.Login)
		auth.POST("/refresh", handler.Refresh)
	}

	authProtected := router.Group("/auth")
	authProtected.Use(authMiddleware)
	{
		authProtected.POST("/logout", handler.Logout)
	}
}
