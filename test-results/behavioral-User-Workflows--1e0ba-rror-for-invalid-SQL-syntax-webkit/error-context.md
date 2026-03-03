# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e2]:
    - generic [ref=e3]:
      - textbox "Enter SQL..." [ref=e4]: INVALID SQL SYNTAX HERE
      - generic [ref=e5]:
        - button "▶ Execute" [active] [ref=e6] [cursor=pointer]
        - button "Clear" [ref=e7] [cursor=pointer]
      - generic [ref=e9]: ✗ Unknown statement
    - generic [ref=e10]:
      - generic [ref=e11]:
        - generic [ref=e12]: Events
        - generic [ref=e13]: "5"
      - generic [ref=e14]:
        - generic [ref=e15]: "2:37:24 PMPARSE{\"sql\":\"INVALID SQL SYNTAX HER"
        - generic [ref=e16]: "2:37:24 PMTOKEN{\"token\":\"INVALID\",\"type\":\"key"
        - generic [ref=e17]: "2:37:24 PMTOKEN{\"token\":\"SQL\",\"type\":\"keyword"
        - generic [ref=e18]: "2:37:24 PMTOKEN{\"token\":\"SYNTAX\",\"type\":\"keyw"
        - generic [ref=e19]: "2:37:24 PMTOKEN{\"token\":\"HERE\",\"type\":\"keywor"
  - generic [ref=e21]:
    - generic [ref=e22]: Ready (41.00ms)
    - generic [ref=e23]:
      - button "B-Tree" [ref=e24] [cursor=pointer]
      - button "Parse" [ref=e25] [cursor=pointer]
      - button "VDBE" [ref=e26] [cursor=pointer]
```