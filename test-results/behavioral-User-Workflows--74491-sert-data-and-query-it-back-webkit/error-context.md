# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e2]:
    - generic [ref=e3]:
      - textbox "Enter SQL..." [ref=e4]: CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT, price REAL);
      - generic [ref=e5]:
        - button "▶ Execute" [active] [ref=e6] [cursor=pointer]
        - button "Clear" [ref=e7] [cursor=pointer]
      - generic [ref=e9]: ✓ Table 'products' created (57.00ms)
    - generic [ref=e10]:
      - generic [ref=e11]:
        - generic [ref=e12]: Events
        - generic [ref=e13]: "14"
      - generic [ref=e14]:
        - generic [ref=e15]: "2:35:45 PMPARSE{\"sql\":\"CREATE TABLE products"
        - generic [ref=e16]: "2:35:45 PMTOKEN{\"token\":\"CREATE\",\"type\":\"keyw"
        - generic [ref=e17]: "2:35:45 PMTOKEN{\"token\":\"TABLE\",\"type\":\"keywo"
        - generic [ref=e18]: "2:35:45 PMTOKEN{\"token\":\"products\",\"type\":\"ke"
        - generic [ref=e19]: "2:35:45 PMTOKEN{\"token\":\"id\",\"type\":\"keyword\""
        - generic [ref=e20]: "2:35:45 PMTOKEN{\"token\":\"INTEGER\",\"type\":\"key"
        - generic [ref=e21]: "2:35:45 PMTOKEN{\"token\":\"PRIMARY\",\"type\":\"key"
        - generic [ref=e22]: "2:35:45 PMTOKEN{\"token\":\"KEY\",\"type\":\"keyword"
        - generic [ref=e23]: "2:35:45 PMTOKEN{\"token\":\"name\",\"type\":\"keywor"
        - generic [ref=e24]: "2:35:45 PMTOKEN{\"token\":\"TEXT\",\"type\":\"keywor"
        - generic [ref=e25]: "2:35:45 PMTOKEN{\"token\":\"price\",\"type\":\"keywo"
        - generic [ref=e26]: "2:35:45 PMTOKEN{\"token\":\"REAL\",\"type\":\"keywor"
        - generic [ref=e27]: "2:35:45 PMPAGE{\"page\":1}"
        - generic [ref=e28]: "2:35:45 PMDONE{\"success\":true}"
  - generic [ref=e30]:
    - generic [ref=e31]: Done (57.00ms)
    - generic [ref=e32]:
      - button "B-Tree" [ref=e33] [cursor=pointer]
      - button "Parse" [ref=e34] [cursor=pointer]
      - button "VDBE" [ref=e35] [cursor=pointer]
```