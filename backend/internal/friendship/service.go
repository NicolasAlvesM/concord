package friendship

import (
	"context"
	"errors"

	"gin-quickstart/backend/internal/user"
)

var (
	ErrCannotAddSelf       = errors.New("cannot send friend request to yourself")
	ErrFriendshipExists    = errors.New("friend request already exists")
	ErrFriendshipNotFound  = errors.New("friendship not found")
	ErrNotAddressee        = errors.New("only the addressee can accept or decline")
	ErrNotRequester        = errors.New("only the requester can cancel the request")
	ErrNotPending          = errors.New("friendship is not pending")
	ErrNotFriends          = errors.New("you are not friends with this user")
)

type Service struct {
	repository  *Repository
	userService *user.Service
	publisher   EventPublisher
}

func FriendshipService(repository *Repository, userService *user.Service, publisher EventPublisher) *Service {
	return &Service{
		repository:  repository,
		userService: userService,
		publisher:   publisher,
	}
}

func (s *Service) SendRequest(ctx context.Context, requesterID string, addresseeUsername string) error {
	if requesterID == "" {
		return errors.New("requester_id is required")
	}

	if addresseeUsername == "" {
		return errors.New("username is required")
	}

	addressee, err := s.userService.FindByUsername(ctx, addresseeUsername)
	if err != nil {
		return errors.New("user not found")
	}

	if requesterID == addressee.ID {
		return ErrCannotAddSelf
	}

	existing, _ := s.repository.Find(ctx, requesterID, addressee.ID)
	if existing != nil {
		if existing.Status == "pending" {
			return ErrFriendshipExists
		}
		if existing.Status == "accepted" {
			return ErrFriendshipExists
		}
	}

	if err := s.repository.Create(ctx, requesterID, addressee.ID); err != nil {
		return err
	}

	if s.publisher != nil {
		if requester, err := s.userService.FindByID(ctx, requesterID); err == nil {
			s.publisher.PublishFriendRequest(addressee.ID, requester)
		}
	}

	return nil
}

func (s *Service) AcceptRequest(ctx context.Context, addresseeID string, requesterUsername string) error {
	requester, err := s.userService.FindByUsername(ctx, requesterUsername)
	if err != nil {
		return errors.New("user not found")
	}

	friendship, err := s.repository.Find(ctx, requester.ID, addresseeID)
	if err != nil {
		return ErrFriendshipNotFound
	}

	if friendship.AddresseeID != addresseeID {
		return ErrNotAddressee
	}

	if friendship.Status != "pending" {
		return ErrNotPending
	}

	if err := s.repository.UpdateStatus(ctx, requester.ID, addresseeID, "accepted"); err != nil {
		return err
	}

	if s.publisher != nil {
		if addressee, err := s.userService.FindByID(ctx, addresseeID); err == nil {
			s.publisher.PublishFriendAccepted(requester.ID, addressee)
		}
	}

	return nil
}

func (s *Service) DeclineRequest(ctx context.Context, addresseeID string, requesterUsername string) error {
	requester, err := s.userService.FindByUsername(ctx, requesterUsername)
	if err != nil {
		return errors.New("user not found")
	}

	friendship, err := s.repository.Find(ctx, requester.ID, addresseeID)
	if err != nil {
		return ErrFriendshipNotFound
	}

	if friendship.AddresseeID != addresseeID {
		return ErrNotAddressee
	}

	if friendship.Status != "pending" {
		return ErrNotPending
	}

	if err := s.repository.Delete(ctx, requester.ID, addresseeID); err != nil {
		return err
	}

	if s.publisher != nil {
		if addressee, err := s.userService.FindByID(ctx, addresseeID); err == nil {
			s.publisher.PublishFriendDeclined(requester.ID, addressee)
		}
	}

	return nil
}

func (s *Service) CancelRequest(ctx context.Context, requesterID string, addresseeUsername string) error {
	addressee, err := s.userService.FindByUsername(ctx, addresseeUsername)
	if err != nil {
		return errors.New("user not found")
	}

	friendship, err := s.repository.Find(ctx, requesterID, addressee.ID)
	if err != nil {
		return ErrFriendshipNotFound
	}

	if friendship.RequesterID != requesterID {
		return ErrNotRequester
	}

	if friendship.Status != "pending" {
		return ErrNotPending
	}

	if err := s.repository.Delete(ctx, requesterID, addressee.ID); err != nil {
		return err
	}

	if s.publisher != nil {
		if requester, err := s.userService.FindByID(ctx, requesterID); err == nil {
			s.publisher.PublishFriendCancelled(addressee.ID, requester)
		}
	}

	return nil
}

func (s *Service) RemoveFriend(ctx context.Context, userID string, friendUsername string) error {
	friend, err := s.userService.FindByUsername(ctx, friendUsername)
	if err != nil {
		return errors.New("user not found")
	}

	friendship, err := s.repository.Find(ctx, userID, friend.ID)
	if err != nil {
		return ErrFriendshipNotFound
	}

	if friendship.Status != "accepted" {
		return ErrNotFriends
	}

	if err := s.repository.Delete(ctx, userID, friend.ID); err != nil {
		return err
	}

	if s.publisher != nil {
		me, meErr := s.userService.FindByID(ctx, userID)
		if meErr == nil {
			s.publisher.PublishFriendRemoved(friend.ID, me)
		}
		s.publisher.PublishFriendRemoved(userID, friend)
	}

	return nil
}

func (s *Service) ListFriends(ctx context.Context, userID string) ([]user.User, error) {
	return s.repository.ListFriends(ctx, userID)
}

func (s *Service) ListPending(ctx context.Context, userID string) ([]PendingRequest, error) {
	incoming, err := s.repository.ListPending(ctx, userID)
	if err != nil {
		return nil, err
	}

	outgoing, err := s.repository.ListSent(ctx, userID)
	if err != nil {
		return nil, err
	}

	return append(incoming, outgoing...), nil
}

func (s *Service) AreFriends(ctx context.Context, userID1 string, userID2 string) (bool, error) {
	friendship, err := s.repository.Find(ctx, userID1, userID2)
	if err != nil {
		return false, nil
	}
	return friendship.Status == "accepted", nil
}
