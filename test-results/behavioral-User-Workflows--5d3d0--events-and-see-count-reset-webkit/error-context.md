# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e2]:
    - generic [ref=e3]:
      - textbox "Enter SQL..." [ref=e4]: SELECT 1;
      - generic [ref=e5]:
        - button "▶ Execute" [active] [ref=e6] [cursor=pointer]
        - button "Clear" [ref=e7] [cursor=pointer]
      - generic [ref=e9]: ✗ Unknown statement
    - generic [ref=e10]:
      - generic [ref=e11]:
        - generic [ref=e12]: Events
        - generic [ref=e13]: "3"
      - generic [ref=e14]:
        - generic [ref=e15]: "2:36:51 PMPARSE{\"sql\":\"SELECT 1;\"}"
        - generic [ref=e16]: "2:36:51 PMTOKEN{\"token\":\"SELECT\",\"type\":\"keyw"
        - generic [ref=e17]: "2:36:51 PMTOKEN{\"token\":\"1\",\"type\":\"keyword\","
  - generic [ref=e19]:
    - generic [ref=e20]: Ready (35.00ms)
    - generic [ref=e21]:
      - button "B-Tree" [ref=e22] [cursor=pointer]
      - button "Parse" [ref=e23] [cursor=pointer]
      - button "VDBE" [ref=e24] [cursor=pointer]
```