# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e2]:
    - generic [ref=e3]:
      - textbox "Enter SQL..." [ref=e4]: CREATE TABLE inventory ( id INTEGER PRIMARY KEY, product_name TEXT, quantity INTEGER, price REAL );
      - generic [ref=e5]:
        - button "▶ Execute" [active] [ref=e6] [cursor=pointer]
        - button "Clear" [ref=e7] [cursor=pointer]
      - generic [ref=e9]: ✗ Unknown statement
    - generic [ref=e10]:
      - generic [ref=e11]:
        - generic [ref=e12]: Events
        - generic [ref=e13]: "14"
      - generic [ref=e14]:
        - generic [ref=e15]: "2:37:42 PMPARSE{\"sql\":\"CREATE TABLE inventory"
        - generic [ref=e16]: "2:37:42 PMTOKEN{\"token\":\"CREATE\",\"type\":\"keyw"
        - generic [ref=e17]: "2:37:42 PMTOKEN{\"token\":\"TABLE\",\"type\":\"keywo"
        - generic [ref=e18]: "2:37:42 PMTOKEN{\"token\":\"inventory\",\"type\":\"k"
        - generic [ref=e19]: "2:37:42 PMTOKEN{\"token\":\"id\",\"type\":\"keyword\""
        - generic [ref=e20]: "2:37:42 PMTOKEN{\"token\":\"INTEGER\",\"type\":\"key"
        - generic [ref=e21]: "2:37:42 PMTOKEN{\"token\":\"PRIMARY\",\"type\":\"key"
        - generic [ref=e22]: "2:37:42 PMTOKEN{\"token\":\"KEY\",\"type\":\"keyword"
        - generic [ref=e23]: "2:37:42 PMTOKEN{\"token\":\"product_name\",\"type\""
        - generic [ref=e24]: "2:37:42 PMTOKEN{\"token\":\"TEXT\",\"type\":\"keywor"
        - generic [ref=e25]: "2:37:42 PMTOKEN{\"token\":\"quantity\",\"type\":\"ke"
        - generic [ref=e26]: "2:37:42 PMTOKEN{\"token\":\"INTEGER\",\"type\":\"key"
        - generic [ref=e27]: "2:37:42 PMTOKEN{\"token\":\"price\",\"type\":\"keywo"
        - generic [ref=e28]: "2:37:42 PMTOKEN{\"token\":\"REAL\",\"type\":\"keywor"
  - generic [ref=e30]:
    - generic [ref=e31]: Ready (35.00ms)
    - generic [ref=e32]:
      - button "B-Tree" [ref=e33] [cursor=pointer]
      - button "Parse" [ref=e34] [cursor=pointer]
      - button "VDBE" [ref=e35] [cursor=pointer]
```