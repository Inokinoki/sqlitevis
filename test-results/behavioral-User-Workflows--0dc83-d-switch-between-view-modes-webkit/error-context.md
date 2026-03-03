# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - generic [ref=e3]:
      - textbox "Enter SQL..." [ref=e4]: CREATE TABLE users(id, name, email); INSERT INTO users VALUES(1, 'Alice', 'alice@example.com'); INSERT INTO users VALUES(2, 'Bob', 'bob@example.com'); SELECT * FROM users;
      - generic [ref=e5]:
        - button "▶ Execute" [ref=e6] [cursor=pointer]
        - button "Clear" [ref=e7] [cursor=pointer]
    - generic [ref=e10]:
      - generic [ref=e11]: Events
      - generic [ref=e12]: "0"
  - generic [ref=e15]:
    - generic [ref=e16]: Ready (35.00ms)
    - generic [ref=e17]:
      - button "B-Tree" [ref=e18] [cursor=pointer]
      - button "Parse" [ref=e19] [cursor=pointer]
      - button "VDBE" [ref=e20] [cursor=pointer]
```