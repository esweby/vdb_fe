package main

import (
	"bytes"
	"context"
	"errors"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
)

// s3Store is ingest.Store on an S3 bucket.
type s3Store struct {
	c      *s3.Client
	bucket string
}

func (s s3Store) Exists(ctx context.Context, key string) (bool, error) {
	_, err := s.c.HeadObject(ctx, &s3.HeadObjectInput{Bucket: aws.String(s.bucket), Key: aws.String(key)})
	var nf *types.NotFound
	if errors.As(err, &nf) {
		return false, nil
	}
	return err == nil, err
}

func (s s3Store) Put(ctx context.Context, key string, body []byte) error {
	_, err := s.c.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(s.bucket),
		Key:         aws.String(key),
		Body:        bytes.NewReader(body),
		ContentType: aws.String("application/gzip"),
	})
	return err
}
