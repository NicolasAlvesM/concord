package user

import (
	"context"
	"errors"

	"github.com/google/uuid"
)

var (
	ErrUsernameRequired = errors.New("username is required")
	ErrEmailRequired    = errors.New("email is required")
)

type Service struct {
	repository *Repository
}

func UserService(repository *Repository) *Service {
	return &Service{
		repository: repository,
	}
}

func (s *Service) FindByID(ctx context.Context, id string) (*User, error) {
	return s.repository.FindByID(ctx, id)
}

func (s *Service) FindByUsername(ctx context.Context, username string) (*User, error) {
	return s.repository.FindByUsername(ctx, username)
}

func (s *Service) SearchByUsername(ctx context.Context, query string, excludeUserID string) ([]User, error) {
	return s.repository.SearchByUsername(ctx, query, excludeUserID)
}

func (s *Service) FindByEmail(ctx context.Context, email string) (*User, error) {
	return s.repository.FindByEmail(ctx, email)
}

func (s *Service) Create(
	ctx context.Context,
	user *User,
) error {
	if user.Username == "" {
		return ErrUsernameRequired
	}

	if user.Email == "" {
		return ErrEmailRequired
	}

	user.ID = uuid.New().String()

	return s.repository.Create(ctx, user)
}
