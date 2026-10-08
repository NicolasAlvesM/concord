package conversation

import (
	"context"
	"errors"

	"github.com/google/uuid"
)

var (
	ErrNotFound = errors.New("conversation not found")
)

type Service struct {
	repository *Repository
}

func ConversationService(repository *Repository) *Service {
	return &Service{
		repository: repository,
	}
}

func (s *Service) GetOrCreateWith(ctx context.Context, userID string, otherUserID string) (*Conversation, error) {
	userA, userB := userID, otherUserID
	if userA > userB {
		userA, userB = userB, userA
	}

	existing, err := s.repository.FindByPair(ctx, userA, userB)
	if err == nil {
		return existing, nil
	}

	conv := &Conversation{
		ID:      uuid.New().String(),
		UserAID: userA,
		UserBID: userB,
	}

	if err := s.repository.Create(ctx, conv); err != nil {
		return nil, err
	}

	return conv, nil
}

func (s *Service) FindByID(ctx context.Context, id string) (*Conversation, error) {
	conv, err := s.repository.FindByID(ctx, id)
	if err != nil {
		return nil, ErrNotFound
	}
	return conv, nil
}

func (s *Service) IsParticipant(ctx context.Context, id string, userID string) (bool, error) {
	conv, err := s.repository.FindByID(ctx, id)
	if err != nil {
		return false, err
	}
	return conv.UserAID == userID || conv.UserBID == userID, nil
}

func (s *Service) ListByUserID(ctx context.Context, userID string) ([]Summary, error) {
	return s.repository.ListByUserID(ctx, userID)
}