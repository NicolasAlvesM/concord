package main

import (
	"log"
	"os"
	"time"

	"gin-quickstart/backend/internal/auth"
	"gin-quickstart/backend/internal/call"
	"gin-quickstart/backend/internal/channel"
	"gin-quickstart/backend/internal/conversation"
	"gin-quickstart/backend/internal/database"
	"gin-quickstart/backend/internal/friendship"
	"gin-quickstart/backend/internal/message"
	"gin-quickstart/backend/internal/server"
	"gin-quickstart/backend/internal/user"
	"gin-quickstart/backend/internal/websocket"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func loadEnv() {
	candidates := []string{".env", "../.env", "../../.env", "backend/.env"}
	for _, path := range candidates {
		if _, err := os.Stat(path); err == nil {
			if err := godotenv.Load(path); err != nil {
				log.Printf("failed to load %s: %v", path, err)
			}
			return
		}
	}
	log.Println("No .env file found")
}

func findMigrationsDir() string {
	candidates := []string{"migrations", "../migrations", "../../migrations", "backend/migrations"}
	for _, path := range candidates {
		if info, err := os.Stat(path); err == nil && info.IsDir() {
			return path
		}
	}
	return "migrations"
}

func main() {
	loadEnv()

	databaseURL := os.Getenv("DATABASE_URL")

	db, err := database.Connect(databaseURL)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	if err := database.Migrate(db, findMigrationsDir()); err != nil {
		log.Fatalf("failed to run migrations: %v", err)
	}

	router := gin.Default()

	router.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:5173"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// Auth
	authRepository := auth.AuthRepository(db)
	authService := auth.AuthService(authRepository)

	// User
	userRepository := user.UserRepository(db)
	userService := user.UserService(userRepository)

	// WebSocket hub (created before services that publish events)
	hub := websocket.NewHub()

	// Server
	serverRepository := server.ServerRepository(db)
	serverService := server.ServerService(serverRepository, hub)

	// Friendship
	friendshipRepository := friendship.FriendshipRepository(db)
	friendshipService := friendship.FriendshipService(friendshipRepository, userService, hub)
	friendshipHandler := friendship.FriendshipHandler(friendshipService)

	// Channel
	channelRepository := channel.ChannelRepository(db)
	channelService := channel.ChannelService(channelRepository, hub)
	channelHandler := channel.ChannelHandler(channelService)

	serverHandler := server.ServerHandler(serverService, friendshipService, userService, channelService)

	// Conversation (DM)
	conversationRepository := conversation.ConversationRepository(db)
	conversationService := conversation.ConversationService(conversationRepository)
	conversationHandler := conversation.ConversationHandler(conversationService, friendshipService, userService)

	// Message
	messageRepository := message.MessageRepository(db)
	messageService := message.MessageService(messageRepository, hub, channelRepository, conversationRepository)
	messageHandler := message.MessageHandler(messageService, channelService, conversationService, friendshipService, serverService)

	// Call (WebRTC signaling foundation)
	callRepository := call.CallRepository(db)
	callService := call.CallService(callRepository, hub, conversationService, serverService, channelService, userService, hub.IsOnline)
	callHandler := call.CallHandler(callService)

	// WebSocket handler
	wsHandler := websocket.WsHandler(hub, authService, channelService, serverService, conversationService, callService)
	hub.SetDisconnectHandler(callService.HandleDisconnect)

	// Auth middleware
	authMiddleware := auth.AuthMiddleware(authService)

	api := router.Group("/api")

	// Auth routes (public)
	authHandler := auth.AuthHandler(authService, userService)
	auth.AuthRoutes(api, authHandler, authMiddleware)

	// Protected routes
	userHandler := user.UserHandler(userService)
	user.UserRoutes(api, userHandler, authMiddleware)
	friendship.FriendRoutes(api, friendshipHandler, authMiddleware)
	server.ServerRoutes(api, serverHandler, authMiddleware)
	channel.ChannelRoutes(api, channelHandler, authMiddleware)
	conversation.ConversationRoutes(api, conversationHandler, authMiddleware)
	message.MessageRoutes(api, messageHandler, authMiddleware)
	call.CallRoutes(api, callHandler, authMiddleware)

	// Presence (protected)
	presence := api.Group("/presence")
	presence.Use(authMiddleware)
	{
		presence.GET("", wsHandler.Presence)
		presence.GET("/", wsHandler.Presence)
	}

	// WebSocket endpoint (public, auth via ?token=)
	router.GET("/ws", wsHandler.ServeWS)

	if err := router.Run(":8080"); err != nil {
		log.Fatal(err)
	}
}
