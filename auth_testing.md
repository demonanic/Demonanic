# Demonanic Auth Testing Playbook

## API Testing (localhost)
```
# register
curl -s -X POST http://localhost:8001/api/auth/register -H "Content-Type: application/json" \
  -d '{"username":"qatester","password":"test123"}'

# login (grab token)
TOKEN=$(curl -s -X POST http://localhost:8001/api/auth/login -H "Content-Type: application/json" \
  -d '{"username":"qatester","password":"test123"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")

# me
curl -s http://localhost:8001/api/auth/me -H "Authorization: Bearer $TOKEN"

# game state (creates none on first call; frontend creates initial state)
curl -s http://localhost:8001/api/game/state -H "Authorization: Bearer $TOKEN"

# save state
curl -s -X PUT http://localhost:8001/api/game/state -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"state":{"gold":999,"workersGold":2,"farmers":2,"morale":50,"castleHp":1000,"castleMaxHp":1000,"lastSeen":"2020-01-01T00:00:00+00:00"}}'

# offline accrual: after saving lastSeen far in the past, GET should credit capped (12h) production
curl -s http://localhost:8001/api/game/state -H "Authorization: Bearer $TOKEN"

# monetization mock
curl -s -X POST http://localhost:8001/api/monetization/reward -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"reward_type":"revive_hero"}'
```

## Verify
- register/login return a JWT token and user {id, username}.
- duplicate username register -> 400.
- wrong password login -> 401.
- /me without token -> 401.
- save then GET returns the same state; offline accrual adds gold/food/stone (capped at 12h) and sets _offlineGains.
- monetization reward returns granted:true, mock:true.
