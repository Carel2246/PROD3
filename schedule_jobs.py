from ortools.sat.python import cp_model
import pandas as pd
from fetch_data import fetch_data  # Import the fetch_data function
from datetime import datetime, timedelta
import sqlalchemy as sa
from sqlalchemy import create_engine
from dotenv import load_dotenv
import os
import tkinter as tk
from tkcalendar import DateEntry
import tkinter.ttk as ttk
import webbrowser

# Load environment variables from .env file
load_dotenv()

# Retrieve database credentials from environment variables
DB_HOST = os.getenv("DB_HOST")
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASS = os.getenv("DB_PASS")
DB_PORT = os.getenv("DB_PORT")

# Create SQLAlchemy engine
connection_string = f"postgresql+psycopg2://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
engine = create_engine(connection_string)

# Function to convert time strings (e.g., "08:00:00") to minutes since midnight
def time_to_minutes(time_str):
    if pd.isna(time_str):
        return 0
    time_obj = datetime.strptime(str(time_str), "%H:%M:%S")
    return time_obj.hour * 60 + time_obj.minute

# Function to map elapsed minutes to a datetime, respecting working hours
def elapsed_minutes_to_datetime(elapsed_minutes, start_date, working_hours):
    current_date = start_date
    remaining_minutes = elapsed_minutes
    total_minutes = 0
    start_minutes = 0  # Initialize to avoid UnboundLocalError
    max_days = 365  # Arbitrary limit to prevent infinite loops

    day_count = 0
    while remaining_minutes > 0 and day_count < max_days:
        # Determine the weekday for the current date (1 = Monday, 7 = Sunday)
        weekday = current_date.isoweekday()  # 1 = Monday, 7 = Sunday
        start_minutes, end_minutes = working_hours.get(weekday, (0, 0))

        if start_minutes == end_minutes:  # Non-working day
            current_date += timedelta(days=1)
            day_count += 1
            continue

        # Calculate available minutes in the current day
        day_start = total_minutes
        day_end = total_minutes + (end_minutes - start_minutes)

        if remaining_minutes <= (end_minutes - start_minutes):
            # The elapsed minute falls within this day
            minutes_into_day = start_minutes + remaining_minutes
            return current_date + timedelta(minutes=minutes_into_day)

        # Move to the next day
        remaining_minutes -= (end_minutes - start_minutes)
        total_minutes += (end_minutes - start_minutes)
        current_date += timedelta(days=1)
        day_count += 1

    # If we run out of days or no working day is found, find the next working day
    while day_count < max_days:
        weekday = current_date.isoweekday()
        start_minutes, end_minutes = working_hours.get(weekday, (0, 0))
        if start_minutes != end_minutes:  # Working day found
            return current_date + timedelta(minutes=start_minutes)
        current_date += timedelta(days=1)
        day_count += 1

    # Fallback: return the start_date if no working day is found within max_days
    print(f"Warning: Could not find a working day within {max_days} days from {start_date}. Returning start_date.")
    return start_date

# Main scheduling function
def schedule_jobs(start_date):
    # Fetch data from the database
    data = fetch_data()
    if data is None:
        print("Failed to fetch data. Exiting.")
        return

    jobs_df = data["jobs"]
    tasks_df = data["tasks"]
    resources_df = data["resources"]
    calendar_df = data["calendar"]
    resource_mapping = data["resource_mapping"]
    resource_group_mapping = data["resource_group_mapping"]

    # Step 1: Prepare working hours from calendar
    working_hours = {}
    for _, row in calendar_df.iterrows():
        day = row["weekday"]  # 1 to 7 (Monday to Sunday)
        start_minutes = time_to_minutes(row["start_time"])
        end_minutes = time_to_minutes(row["end_time"])
        working_hours[day] = (start_minutes, end_minutes)

    # Debug: Print working hours
    print("Working hours by weekday:")
    for day in range(1, 8):
        if day in working_hours:
            start_mins, end_mins = working_hours[day]
            print(f"  Day {day}: {start_mins // 60}:{start_mins % 60:02d} to {end_mins // 60}:{end_mins % 60:02d}")
        else:
            print(f"  Day {day}: No working hours")

    # Step 2: Compute task durations and organize tasks by job
    job_tasks = {}
    all_tasks = []
    task_to_index = {}
    index = 0

    for job_id in jobs_df["id"]:
        job_number = jobs_df[jobs_df["id"] == job_id]["job_number"].iloc[0]
        quantity = jobs_df[jobs_df["id"] == job_id]["quantity"].iloc[0]
        job_tasks[job_number] = []

        # Get tasks for this job
        job_tasks_df = tasks_df[tasks_df["job_number"] == job_number]
        for _, task in job_tasks_df.iterrows():
            task_id = (job_number, task["task_number"])
            duration = (task["setup_time"] or 0) + (task["time_each"] or 0) * (quantity or 1)
            resources = task["resources"]
            predecessors = task["predecessors"]
            task_to_index[task_id] = index
            all_tasks.append({
                "task_id": task_id,
                "duration": int(duration),
                "resources": resources,  # List of resource names or group names
                "predecessors": predecessors  # List of predecessor task numbers
            })
            job_tasks[job_number].append(index)
            index += 1

    # Step 3: Set up the OR-Tools model
    model = cp_model.CpModel()

    # Define the horizon (maximum possible elapsed minutes)
    horizon = sum(task["duration"] for task in all_tasks) * 2  # Rough estimate

    # Variables: Start and end times for each task in elapsed minutes
    task_starts = {}
    task_ends = {}
    for i, task in enumerate(all_tasks):
        task_starts[i] = model.NewIntVar(0, horizon, f"start_{i}")
        task_ends[i] = model.NewIntVar(0, horizon, f"end_{i}")
        model.Add(task_ends[i] == task_starts[i] + task["duration"])

    # Predecessor constraints
    for i, task in enumerate(all_tasks):
        if not task["predecessors"]:
            continue

        # Enforce the constraint for each predecessor
        for pred_task_number in task["predecessors"]:
            # Skip invalid predecessor values like "nan"
            if not pred_task_number or pred_task_number.lower() == "nan":
                continue
            pred_task_id = (task["task_id"][0], pred_task_number)  # Same job, predecessor task_number
            if pred_task_id in task_to_index:
                pred_index = task_to_index[pred_task_id]
                model.Add(task_starts[i] >= task_ends[pred_index])
            else:
                print(f"Warning: Predecessor {pred_task_id} for task {task['task_id']} not found.")

    # Resource constraints: Dynamically assign resources from groups
    resource_intervals = {res_id: [] for res_id in resources_df["id"]}
    task_resource_assignments = {}  # Store the assigned resource for each task

    for i, task in enumerate(all_tasks):
        task_resources = task["resources"]
        if not task_resources:
            continue  # Skip tasks with no resources

        # For each resource requirement in the task
        for res in task_resources:
            # Case 1: Direct resource name
            if res in resource_mapping:
                res_id = resource_mapping[res]
                if res_id != -1:
                    interval = model.NewIntervalVar(
                        task_starts[i], task["duration"], task_ends[i], f"interval_{i}_res_{res_id}"
                    )
                    resource_intervals[res_id].append(interval)
                    if i not in task_resource_assignments:
                        task_resource_assignments[i] = []
                    task_resource_assignments[i].append(res_id)
            # Case 2: Resource group name
            elif res in resource_group_mapping:
                group_resources = resource_group_mapping[res]
                if not group_resources:
                    print(f"Warning: Resource group {res} has no resources for task {task['task_id']}.")
                    continue

                # Create a decision variable to select one resource from the group
                selected_resource = model.NewIntVarFromDomain(
                    cp_model.Domain.FromValues(group_resources),
                    f"selected_resource_{i}_{res}"
                )

                # Create intervals for each possible resource in the group
                intervals = []
                bool_vars = []
                for res_id in group_resources:
                    # Create a boolean variable to indicate if this resource is used
                    is_active = model.NewBoolVar(f"use_res_{res_id}_for_task_{i}")
                    interval = model.NewOptionalIntervalVar(
                        task_starts[i],
                        task["duration"],
                        task_ends[i],
                        is_active,
                        f"interval_{i}_res_{res_id}"
                    )
                    intervals.append((res_id, interval, is_active))
                    bool_vars.append(is_active)

                # Ensure exactly one resource is selected
                model.AddExactlyOne(bool_vars)

                # Add the selected interval to the resource's interval list
                for res_id, interval, is_active in intervals:
                    resource_intervals[res_id].append(interval)

                # Link the selected_resource to the is_active variables
                for res_id, _, is_active in intervals:
                    model.Add(selected_resource == res_id).OnlyEnforceIf(is_active)
                    model.Add(selected_resource != res_id).OnlyEnforceIf(is_active.Not())

                # Store the selected resource for output
                if i not in task_resource_assignments:
                    task_resource_assignments[i] = []
                task_resource_assignments[i].append(selected_resource)

    # Enforce no overlap for each resource
    for res_id, intervals in resource_intervals.items():
        if intervals:
            print(f"Resource {res_id} has {len(intervals)} intervals.")
            model.AddNoOverlap(intervals)

    # Objective: Minimize makespan
    makespan = model.NewIntVar(0, horizon, "makespan")
    model.AddMaxEquality(makespan, [task_ends[i] for i in range(len(all_tasks))])
    model.Minimize(makespan)

    # Step 4: Solve the model
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 60.0  # Limit solving time to 60 seconds
    status = solver.Solve(model)

    # Step 5: Output the schedule and save to database
    if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
        print("\nSchedule found!")
        print(f"Makespan: {solver.Value(makespan)} elapsed minutes")
        schedule = []
        # Create a reverse mapping from resource ID to name
        id_to_resource = {v: k for k, v in resource_mapping.items()}
        # For debugging: Track resource usage over time
        resource_usage = {res_id: [] for res_id in resources_df["id"]}
        for i, task in enumerate(all_tasks):
            start = solver.Value(task_starts[i])
            end = solver.Value(task_ends[i])

            # Map elapsed minutes to real datetimes
            start_datetime = elapsed_minutes_to_datetime(start, start_date, working_hours)
            end_datetime = elapsed_minutes_to_datetime(end, start_date, working_hours)

            # Resolve the assigned resources
            assigned_resources = []
            for res in task_resource_assignments.get(i, []):
                if isinstance(res, int):
                    assigned_resources.append(res)
                else:
                    assigned_resources.append(solver.Value(res))
            # Convert resource IDs to names
            resource_names = [id_to_resource.get(res_id, str(res_id)) for res_id in assigned_resources]
            resources_used = ",".join(resource_names)

            # Log resource usage for debugging
            for res_id in assigned_resources:
                resource_usage[res_id].append((task["task_id"], start, end))

            print(f"Task {task['task_id']}: Start = {start_datetime}, End = {end_datetime}, Resources = {resource_names}")
            schedule.append({
                "task_number": task["task_id"][1],
                "start_time": start_datetime,
                "end_time": end_datetime,
                "resources_used": resources_used
            })

        # Debug: Check for resource overlaps
        for res_id, usage in resource_usage.items():
            if not usage:
                continue
            usage.sort(key=lambda x: x[1])  # Sort by start time
            print(f"\nResource {id_to_resource.get(res_id, res_id)} usage (in elapsed minutes):")
            for task_id, start, end in usage:
                start_dt = elapsed_minutes_to_datetime(start, start_date, working_hours)
                end_dt = elapsed_minutes_to_datetime(end, start_date, working_hours)
                print(f"  Task {task_id}: {start} to {end} (Real time: {start_dt} to {end_dt})")
            # Check for overlaps
            for j in range(len(usage) - 1):
                task1, start1, end1 = usage[j]
                task2, start2, end2 = usage[j + 1]
                if end1 > start2:
                    print(f"  Overlap detected: Task {task1} (ends {end1}) overlaps with Task {task2} (starts {start2})")

        # Step 6: Save the schedule to the database
        try:
            with engine.connect() as conn:
                # Clear existing schedule entries (optional)
                conn.execute(sa.text("DELETE FROM public.schedule;"))
                # Insert new schedule entries
                for entry in schedule:
                    query = sa.text("""
                        INSERT INTO public.schedule (task_number, start_time, end_time, resources_used)
                        VALUES (:task_number, :start_time, :end_time, :resources_used);
                    """)
                    conn.execute(query, {
                        "task_number": entry["task_number"],
                        "start_time": entry["start_time"],
                        "end_time": entry["end_time"],
                        "resources_used": entry["resources_used"]
                    })
                conn.commit()
                print("Schedule successfully saved to the database!")
        except Exception as e:
            print(f"Error saving schedule to database: {e}")
            return None

        return schedule
    else:
        print("No solution found.")
        return None

# GUI class for scheduling
class SchedulerGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("Timely Scheduler")
        self.root.geometry("800x600")  # Set window size

        # Label and date picker for starting date
        self.label = tk.Label(root, text="Select Schedule Start Date:")
        self.label.pack(pady=10)

        self.date_entry = DateEntry(root, width=12, background='darkblue',
                                   foreground='white', borderwidth=2, date_pattern='y-mm-dd')
        self.date_entry.pack(pady=10)

        # Schedule button
        self.schedule_button = tk.Button(root, text="Run Scheduler", command=self.run_scheduler)
        self.schedule_button.pack(pady=10)

        # Status label
        self.status_label = tk.Label(root, text="")
        self.status_label.pack(pady=10)

        # Frame for the table and web interface button
        self.table_frame = tk.Frame(root)
        self.table_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

        # Web interface button (initially hidden)
        self.web_button = tk.Button(self.table_frame, text="View on Web Interface",
                                   command=self.open_web_interface)
        # Table for displaying the schedule (initially empty)
        self.tree = None

    def open_web_interface(self):
        webbrowser.open("https://nmiproduksie.azurewebsites.net/")
        self.root.destroy()  # Close the application

    def display_schedule(self, schedule):
        # Clear any existing table
        if self.tree:
            self.tree.destroy()

        # Show the web interface button
        self.web_button.pack(pady=5)

        # Create a Treeview widget for the table
        self.tree = ttk.Treeview(self.table_frame, columns=("Task Number", "Start Time", "End Time", "Resources Used"),
                                show="headings")
        self.tree.heading("Task Number", text="Task Number")
        self.tree.heading("Start Time", text="Start Time")
        self.tree.heading("End Time", text="End Time")
        self.tree.heading("Resources Used", text="Resources Used")

        # Set column widths
        self.tree.column("Task Number", width=150)
        self.tree.column("Start Time", width=200)
        self.tree.column("End Time", width=200)
        self.tree.column("Resources Used", width=200)

        # Add a scrollbar
        scrollbar = ttk.Scrollbar(self.table_frame, orient=tk.VERTICAL, command=self.tree.yview)
        self.tree.configure(yscrollcommand=scrollbar.set)
        self.tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

        # Populate the table with schedule data
        for entry in schedule:
            self.tree.insert("", tk.END, values=(
                entry["task_number"],
                entry["start_time"].strftime("%Y-%m-%d %H:%M:%S"),
                entry["end_time"].strftime("%Y-%m-%d %H:%M:%S"),
                entry["resources_used"]
            ))

    def run_scheduler(self):
        # Get the selected start date
        start_date_str = self.date_entry.get()
        try:
            start_date = datetime.strptime(start_date_str, "%Y-%m-%d")
            self.status_label.config(text="Scheduling in progress...", fg="blue")
            self.root.update()

            # Run the scheduler with the selected start date
            schedule = schedule_jobs(start_date)

            if schedule:
                self.status_label.config(text="Scheduling complete! Saved to database.", fg="green")
                # Display the schedule in the table
                self.display_schedule(schedule)
            else:
                self.status_label.config(text="Scheduling failed. Check console for details.", fg="red")
        except ValueError:
            self.status_label.config(text="Invalid date format. Use YYYY-MM-DD.", fg="red")

# Main function to launch the GUI
if __name__ == "__main__":
    root = tk.Tk()
    app = SchedulerGUI(root)
    root.mainloop()