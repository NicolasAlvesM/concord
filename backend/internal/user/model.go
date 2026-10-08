package user

import "time"

type User struct {
	ID           string    `json:"id"`
	Username     string    `json:"username"`
	DisplayName  string    `json:"display_name"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	AvatarURL    *string   `json:"avatar_url,omitempty"`
	Active       bool      `json:"-"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}
