package friendship

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	service *Service
}

func FriendshipHandler(service *Service) *Handler {
	return &Handler{
		service: service,
	}
}

func (h *Handler) SendRequest(c *gin.Context) {
	var input struct {
		Username string `json:"username"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	if err := h.service.SendRequest(c.Request.Context(), userID.(string), input.Username); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "friend request sent"})
}

func (h *Handler) AcceptRequest(c *gin.Context) {
	requesterUsername := c.Param("username")

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	if err := h.service.AcceptRequest(c.Request.Context(), userID.(string), requesterUsername); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "friend request accepted"})
}

func (h *Handler) DeclineRequest(c *gin.Context) {
	requesterUsername := c.Param("username")

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	if err := h.service.DeclineRequest(c.Request.Context(), userID.(string), requesterUsername); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "friend request declined"})
}

func (h *Handler) CancelRequest(c *gin.Context) {
	addresseeUsername := c.Param("username")

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	if err := h.service.CancelRequest(c.Request.Context(), userID.(string), addresseeUsername); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "friend request cancelled"})
}

func (h *Handler) RemoveFriend(c *gin.Context) {
	friendUsername := c.Param("username")

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	if err := h.service.RemoveFriend(c.Request.Context(), userID.(string), friendUsername); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "friend removed"})
}

func (h *Handler) ListFriends(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	friends, err := h.service.ListFriends(c.Request.Context(), userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list friends"})
		return
	}

	c.JSON(http.StatusOK, friends)
}

func (h *Handler) ListPending(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	pending, err := h.service.ListPending(c.Request.Context(), userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list pending requests"})
		return
	}

	c.JSON(http.StatusOK, pending)
}
