with open("geojson-export.dat", "r", encoding="utf-8", errors="ignore") as f:
    for i in range(10):
        print(f.readline())