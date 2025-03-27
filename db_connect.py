import psycopg2
from dotenv import load_dotenv
import os

# Load environment variables from .env file
load_dotenv()

# Retrieve database credentials from environment variables
DB_HOST = os.getenv("DB_HOST")
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASS = os.getenv("DB_PASS")
DB_PORT = os.getenv("DB_PORT")

# Function to connect to the database and test a query
def test_db_connection():
    try:
        # Establish connection
        conn = psycopg2.connect(
            host=DB_HOST,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASS,
            port=DB_PORT
        )
        print("Successfully connected to the database!")

        # Create a cursor to execute queries
        cursor = conn.cursor()

        # Test query: Select all rows from the 'resource' table
        cursor.execute("SELECT * FROM resource LIMIT 5;")
        rows = cursor.fetchall()

        # Print the results
        print("\nFirst 5 rows from the 'resource' table:")
        for row in rows:
            print(row)

        # Close the cursor and connection
        cursor.close()
        conn.close()
        print("\nDatabase connection closed.")

    except Exception as e:
        print(f"Error connecting to the database: {e}")

if __name__ == "__main__":
    test_db_connection()