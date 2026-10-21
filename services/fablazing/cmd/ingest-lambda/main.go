// Command ingest-lambda is the daily FaBlazing ingest: an AWS Lambda that
// fetches yesterday's final file for each format and stores the Viserai games
// in S3. See docs/fablazing-plan.md, "Pipeline", and services/fablazing/README.md.
//
// Environment:
//
//	BUCKET                 the raw records bucket
//	API_KEY_PARAMETER      SSM SecureString holding the FaBlazing API key
//	FABLAZING_BASE_URL     defaults to https://fab-insights.azurewebsites.net
//
// The event may carry {"date": "YYYY-MM-DD"} for a manual run; the schedule
// sends none, which means yesterday in UTC.
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/ssm"

	"github.com/esweby/vdb_fe/services/fablazing/ingest"
)

type event struct {
	Date string `json:"date"`
}

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	ctx := context.Background()
	cfg, err := config.LoadDefaultConfig(ctx)
	if err != nil {
		logger.Error("loading AWS config", "error", err)
		os.Exit(1)
	}
	bucket, param := os.Getenv("BUCKET"), os.Getenv("API_KEY_PARAMETER")
	if bucket == "" || param == "" {
		logger.Error("BUCKET and API_KEY_PARAMETER must be set")
		os.Exit(1)
	}
	base := os.Getenv("FABLAZING_BASE_URL")
	if base == "" {
		base = "https://fab-insights.azurewebsites.net"
	}
	s3c, ssmc := s3.NewFromConfig(cfg), ssm.NewFromConfig(cfg)

	lambda.Start(func(ctx context.Context, e event) error {
		date, err := ingest.DateFor(time.Now(), e.Date)
		if err != nil {
			return err
		}
		key, err := apiKey(ctx, ssmc, param)
		if err != nil {
			return err
		}
		in := &ingest.Ingester{
			BaseURL: base,
			APIKey:  key,
			Formats: []int{0, 1},
			HTTP:    &http.Client{Timeout: 4 * time.Minute},
			Store:   s3Store{s3c, bucket},
			// Aggregator: the Supabase writer, once the fablazing_* tables exist.
			Logger: logger,
		}
		_, err = in.Run(ctx, date)
		return err
	})
}

// apiKey reads the key on every run, so a rotated key takes effect at once.
// The error never carries the value.
func apiKey(ctx context.Context, c *ssm.Client, name string) (string, error) {
	out, err := c.GetParameter(ctx, &ssm.GetParameterInput{Name: aws.String(name), WithDecryption: aws.Bool(true)})
	if err != nil {
		return "", fmt.Errorf("reading the API key parameter: %w", err)
	}
	v := aws.ToString(out.Parameter.Value)
	if v == "" {
		return "", errors.New("the API key parameter is empty")
	}
	return v, nil
}
