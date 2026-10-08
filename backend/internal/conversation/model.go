package conversation

import "time"

type Conversation struct {
	ID        string    `json:"id"`
	UserAID   string    `json:"user_a_id"`
	UserBID   string    `json:"user_b_id"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type OtherUser struct {
	ID          string  `json:"id"`
	Username    string  `json:"username"`
	DisplayName string  `json:"display_name"`
	AvatarURL   *string `json:"avatar_url,omitempty"`
}

type LastMessage struct {
	ID        string    `json:"id"`
	AuthorID  string    `json:"author_id"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"created_at"`
}

type Summary struct {
	Conversation
	OtherUser   OtherUser    `json:"other_user"`
	LastMessage *LastMessage `json:"last_message,omitempty"`
}

func (s *Summary) GetOtherUserID(userID string) string {
	if s.UserAID == userID {
		return s.UserBID
	}
	return s.UserAID
}