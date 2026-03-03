# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e2]:
    - generic [ref=e3]:
      - textbox "Enter SQL..." [ref=e4]: CREATE TABLE duplicate_test (id INTEGER);
      - generic [ref=e5]:
        - button "▶ Execute" [active] [ref=e6] [cursor=pointer]
        - button "Clear" [ref=e7] [cursor=pointer]
      - generic [ref=e9]: ✓ Table 'duplicate_test' created (26.00ms)
    - generic [ref=e10]:
      - generic [ref=e11]:
        - generic [ref=e12]: Events
        - generic [ref=e13]: "16"
      - generic [ref=e14]:
        - generic [ref=e15]: "2:37:33 PMTOKEN{\"token\":\"CREATE\",\"type\":\"keyw"
        - generic [ref=e16]: "2:37:33 PMTOKEN{\"token\":\"TABLE\",\"type\":\"keywo"
        - generic [ref=e17]: "2:37:33 PMTOKEN{\"token\":\"duplicate_test\",\"typ"
        - generic [ref=e18]: "2:37:33 PMTOKEN{\"token\":\"id\",\"type\":\"keyword\""
        - generic [ref=e19]: "2:37:33 PMTOKEN{\"token\":\"INTEGER\",\"type\":\"key"
        - generic [ref=e20]: "2:37:33 PMPAGE{\"page\":1}"
        - generic [ref=e21]: "2:37:33 PMDONE{\"success\":true}"
        - generic [ref=e22]: "2:37:34 PMPARSE{\"sql\":\"CREATE TABLE duplicate"
        - generic [ref=e23]: "2:37:34 PMTOKEN{\"token\":\"CREATE\",\"type\":\"keyw"
        - generic [ref=e24]: "2:37:34 PMTOKEN{\"token\":\"TABLE\",\"type\":\"keywo"
        - generic [ref=e25]: "2:37:34 PMTOKEN{\"token\":\"duplicate_test\",\"typ"
        - generic [ref=e26]: "2:37:34 PMTOKEN{\"token\":\"id\",\"type\":\"keyword\""
        - generic [ref=e27]: "2:37:34 PMTOKEN{\"token\":\"INTEGER\",\"type\":\"key"
        - generic [ref=e28]: "2:37:34 PMPAGE{\"page\":1}"
        - generic [ref=e29]: "2:37:34 PMDONE{\"success\":true}"
  - generic [ref=e31]:
    - generic [ref=e32]: Done (26.00ms)
    - generic [ref=e33]:
      - button "B-Tree" [ref=e34] [cursor=pointer]
      - button "Parse" [ref=e35] [cursor=pointer]
      - button "VDBE" [ref=e36] [cursor=pointer]
```