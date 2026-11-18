package location

import (
	"math"
	"testing"

	"github.com/isaac-evs/friends_nearby/backend/internal/models"
)

func TestDistanceM(t *testing.T) {
	cases := []struct {
		name     string
		a, b     models.Location
		want     float64
		tolerate float64
	}{
		{"same point", models.Location{Lat: 19.4326, Lng: -99.1332}, models.Location{Lat: 19.4326, Lng: -99.1332}, 0, 0.001},
		{"one degree of latitude", models.Location{Lat: 0, Lng: 0}, models.Location{Lat: 1, Lng: 0}, 111195, 50},
		{"one degree of longitude at the equator", models.Location{Lat: 0, Lng: 0}, models.Location{Lat: 0, Lng: 1}, 111195, 50},
		{"one degree of longitude at 60N is half", models.Location{Lat: 60, Lng: 0}, models.Location{Lat: 60, Lng: 1}, 55597, 50},
		{"100 m north in Mexico City", models.Location{Lat: 19.4326, Lng: -99.1332}, models.Location{Lat: 19.4326 + 100.0/111195, Lng: -99.1332}, 100, 0.5},
		{"Mexico City to Guadalajara", models.Location{Lat: 19.4326, Lng: -99.1332}, models.Location{Lat: 20.6597, Lng: -103.3496}, 460000, 5000},
		{"across the antimeridian", models.Location{Lat: 0, Lng: 179.5}, models.Location{Lat: 0, Lng: -179.5}, 111195, 50},
		{"pole to pole", models.Location{Lat: 90, Lng: 0}, models.Location{Lat: -90, Lng: 0}, math.Pi * 6371000, 1},
	}
	for _, c := range cases {
		got := DistanceM(c.a, c.b)
		if math.Abs(got-c.want) > c.tolerate {
			t.Errorf("%s: got %.1f m, want %.1f ± %.1f", c.name, got, c.want, c.tolerate)
		}
		if back := DistanceM(c.b, c.a); math.Abs(back-got) > 1e-6 {
			t.Errorf("%s: not symmetric (%.3f vs %.3f)", c.name, got, back)
		}
	}
}
