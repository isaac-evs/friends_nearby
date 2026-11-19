package awsadapters

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/aws/signer/v4"
)

// SES uses the signed AWS Query API. VPC access is documented in INFRA_REQUESTS.
type SESMailer struct {
	Config aws.Config
	From   string
}

func (s SESMailer) SendReset(ctx context.Context, email, link string) error {
	if s.From == "" {
		return errors.New("MAIL_FROM is not configured")
	}
	body := url.Values{"Action": {"SendEmail"}, "Version": {"2010-12-01"}, "Source": {s.From}, "Destination.ToAddresses.member.1": {email}, "Message.Subject.Data": {"Recupera tu cuenta de Friends Nearby"}, "Message.Subject.Charset": {"UTF-8"}, "Message.Body.Text.Data": {"Abre este enlace para crear una contraseña nueva. Expira en 30 minutos:\n\n" + link}, "Message.Body.Text.Charset": {"UTF-8"}}.Encode()
	req, err := http.NewRequestWithContext(ctx, "POST", "https://email."+s.Config.Region+".amazonaws.com/", strings.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded; charset=utf-8")
	creds, err := s.Config.Credentials.Retrieve(ctx)
	if err != nil {
		return err
	}
	sum := sha256.Sum256([]byte(body))
	if err = v4.NewSigner().SignHTTP(ctx, creds, req, hex.EncodeToString(sum[:]), "ses", s.Config.Region, time.Now()); err != nil {
		return err
	}
	res, err := (&http.Client{Timeout: 10 * time.Second}).Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	_, _ = io.Copy(io.Discard, io.LimitReader(res.Body, 65536))
	if res.StatusCode/100 != 2 {
		return fmt.Errorf("SES returned status %d", res.StatusCode)
	}
	return nil
}
