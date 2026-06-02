"""
Seed script: inserts 50 customers, 50 products, and 50 orders.
Run while the backend is up:
    python backend/seed.py
"""
import random
import requests

BASE = "http://localhost:8000"

SEED_USER = {"username": "seed_admin", "password": "SeedPass123!"}

FIRST_NAMES = [
    "Alice", "Bob", "Carol", "Dave", "Eve", "Frank", "Grace", "Henry", "Iris", "Jack",
    "Karen", "Leo", "Mia", "Nate", "Olivia", "Paul", "Quinn", "Rachel", "Sam", "Tina",
    "Uma", "Victor", "Wendy", "Xander", "Yara", "Zoe", "Aaron", "Bella", "Chris", "Diana",
    "Ethan", "Fiona", "George", "Hannah", "Ivan", "Julia", "Kevin", "Laura", "Mike", "Nina",
    "Oscar", "Penny", "Ryan", "Sara", "Tom", "Ursula", "Vince", "Wanda", "Xena", "Yusuf",
]

LAST_NAMES = [
    "Smith", "Jones", "Brown", "Davis", "Miller", "Wilson", "Moore", "Taylor", "Anderson",
    "Thomas", "Jackson", "White", "Harris", "Martin", "Garcia", "Martinez", "Robinson",
    "Clark", "Lewis", "Lee", "Walker", "Hall", "Allen", "Young", "Hernandez", "King",
    "Wright", "Lopez", "Hill", "Scott", "Green", "Adams", "Baker", "Nelson", "Carter",
    "Mitchell", "Perez", "Roberts", "Turner", "Phillips", "Campbell", "Parker", "Evans",
    "Edwards", "Collins", "Stewart", "Sanchez", "Morris", "Rogers", "Reed",
]

PRODUCT_NAMES = [
    "Laptop Pro 15", "Wireless Mouse", "USB-C Hub", "Mechanical Keyboard", 'Monitor 27"',
    "Webcam HD", "Bluetooth Headphones", "Desk Lamp LED", "Standing Desk Mat", "Cable Organizer",
    "SSD 1TB", "RAM 16GB DDR5", "CPU Cooler", "Graphics Card RTX 4060", "Power Supply 650W",
    "Gaming Chair", "Mouse Pad XL", "Portable Speaker", "USB Microphone", "Stream Deck",
    'Tablet 10"', "Smart Watch", "Phone Stand", "Laptop Sleeve", "Screen Cleaner Kit",
    "Ethernet Adapter", "HDMI Cable 2m", "Thunderbolt Dock", "Portable SSD 500GB", "NVMe Drive 2TB",
    "WiFi 6 Router", "8-Port Network Switch", "Raspberry Pi 4", "Arduino Starter Kit", "Soldering Iron",
    "3D Printer Filament PLA", "LED Strip 5m", "Smart Plug", "Surge Protector 6-Port", "UPS 600VA",
    "Thermal Paste", "Cable Ties 100pk", "Velcro Straps", "Label Maker", "Anti-Static Mat",
    "Lens Cloth Pack", "Tempered Glass Protector", "Stylus Pen", "Drawing Tablet A5", "VR Headset",
]


def setup_auth():
    """Register a seed user (ignore 409 if already exists) and return auth headers."""
    requests.post(f"{BASE}/auth/register", json=SEED_USER)
    res = requests.post(
        f"{BASE}/auth/login",
        data={"username": SEED_USER["username"], "password": SEED_USER["password"]},
    )
    if res.status_code != 200:
        raise SystemExit(f"Login failed: {res.text}")
    token = res.json()["access_token"]
    print(f"Authenticated as '{SEED_USER['username']}'")
    return {"Authorization": f"Bearer {token}"}


def seed_customers(headers):
    print("Seeding 50 customers...")
    ids = []
    for i in range(50):
        fn = FIRST_NAMES[i % len(FIRST_NAMES)]
        ln = random.choice(LAST_NAMES)
        email = f"{fn.lower()}.{ln.lower()}{i}@example.com"
        phone = f"+1-555-{random.randint(100, 999)}-{random.randint(1000, 9999)}"
        res = requests.post(f"{BASE}/customers", json={"full_name": f"{fn} {ln}", "email": email, "phone": phone}, headers=headers)
        if res.status_code == 201:
            ids.append(res.json()["id"])
            print(f"  [{i+1}/50] {fn} {ln}")
        else:
            print(f"  [{i+1}/50] FAILED: {res.text}")
    return ids


def seed_products(headers):
    print("\nSeeding 50 products...")
    ids = []
    for i, name in enumerate(PRODUCT_NAMES):
        sku = f"SKU-{1000 + i}"
        price = round(random.uniform(5.99, 999.99), 2)
        quantity = random.randint(10, 200)
        res = requests.post(f"{BASE}/products", json={"name": name, "sku": sku, "price": price, "quantity": quantity}, headers=headers)
        if res.status_code == 201:
            ids.append(res.json()["id"])
            print(f"  [{i+1}/50] {name} — ${price} (qty {quantity})")
        else:
            print(f"  [{i+1}/50] FAILED: {res.text}")
    return ids


def seed_orders(customer_ids, product_ids, headers):
    print("\nSeeding 50 orders...")
    for i in range(50):
        customer_id = random.choice(customer_ids)
        num_items = random.randint(1, 3)
        selected = random.sample(product_ids, num_items)
        items = [{"product_id": pid, "quantity": random.randint(1, 3)} for pid in selected]
        res = requests.post(f"{BASE}/orders", json={"customer_id": customer_id, "items": items}, headers=headers)
        if res.status_code == 201:
            order = res.json()
            print(f"  [{i+1}/50] Order #{order['id']} — customer #{customer_id}, {num_items} item(s), ${order['total_amount']:.2f}")
        else:
            print(f"  [{i+1}/50] FAILED: {res.text}")


if __name__ == "__main__":
    headers = setup_auth()
    customer_ids = seed_customers(headers)
    product_ids = seed_products(headers)
    if customer_ids and product_ids:
        seed_orders(customer_ids, product_ids, headers)
    print("\nDone!")
