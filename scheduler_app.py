import tkinter as tk
from tkinter import ttk, Text
from tkcalendar import DateEntry
import pandas as pd
from datetime import datetime, timedelta
import logging
from pathlib import Path
import sys
from ortools.sat.python import cp_model
from fetch_data import fetch_data, engine
import sqlalchemy as sa
import time

# Setup logging
SCRIPT_DIR = Path(__file__).parent.absolute()
log_file = SCRIPT_DIR / 'scheduler.log'
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(str(log_file)),
        logging.StreamHandler(sys.stdout)
    ]
)

class SchedulerApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Production Scheduler")
        self.root.geometry("1400x800")
        
        # Initialize variables
        self.schedule = None
        self.makespan = None
        
        # Create main frame
        self.main_frame = ttk.Frame(root, padding="10")
        self.main_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        # Create date selection frame
        self.date_frame = ttk.LabelFrame(self.main_frame, text="Schedule Start Date", padding="5")
        self.date_frame.grid(row=0, column=0, sticky=(tk.W, tk.E), pady=5)
        
        self.date_label = ttk.Label(self.date_frame, text="Select Date:")
        self.date_label.grid(row=0, column=0, padx=5)
        
        self.date_entry = DateEntry(
            self.date_frame,
            width=12,
            background='darkblue',
            foreground='white',
            borderwidth=2,
            date_pattern='y-mm-dd'
        )
        self.date_entry.set_date(datetime.now().date() + timedelta(days=1))
        self.date_entry.grid(row=0, column=1, padx=5)
        
        # Create schedule button
        self.schedule_button = ttk.Button(
            self.main_frame,
            text="Generate Schedule",
            command=self.generate_schedule
        )
        self.schedule_button.grid(row=1, column=0, pady=10)
        
        # Create status label
        self.status_label = ttk.Label(self.main_frame, text="")
        self.status_label.grid(row=2, column=0, pady=5)
        
        # Create schedule table
        self.table_frame = ttk.LabelFrame(self.main_frame, text="Schedule", padding="5")
        self.table_frame.grid(row=3, column=0, sticky=(tk.W, tk.E, tk.N, tk.S), pady=5)
        
        # Create treeview
        self.tree = ttk.Treeview(
            self.table_frame,
            columns=("Task", "Start Time", "End Time", "Resources", "Duration", "Start Minute", "End Minute"),
            show="headings"
        )
        
        # Configure columns
        self.tree.heading("Task", text="Task")
        self.tree.heading("Start Time", text="Start Time")
        self.tree.heading("End Time", text="End Time")
        self.tree.heading("Resources", text="Resources")
        self.tree.heading("Duration", text="Duration (min)")
        self.tree.heading("Start Minute", text="Start Minute")
        self.tree.heading("End Minute", text="End Minute")
        
        self.tree.column("Task", width=150)
        self.tree.column("Start Time", width=200)
        self.tree.column("End Time", width=200)
        self.tree.column("Resources", width=300)
        self.tree.column("Duration", width=100)
        self.tree.column("Start Minute", width=100)
        self.tree.column("End Minute", width=100)
        
        # Add scrollbar
        scrollbar = ttk.Scrollbar(self.table_frame, orient=tk.VERTICAL, command=self.tree.yview)
        self.tree.configure(yscrollcommand=scrollbar.set)
        
        # Pack tree and scrollbar
        self.tree.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        scrollbar.grid(row=0, column=1, sticky=(tk.N, tk.S))
        
        # Create copyable text display
        self.text_frame = ttk.LabelFrame(self.main_frame, text="Copyable Schedule", padding="5")
        self.text_frame.grid(row=4, column=0, sticky=(tk.W, tk.E, tk.N, tk.S), pady=5)
        
        self.schedule_text = Text(self.text_frame, height=10, width=120, wrap=tk.NONE)
        self.schedule_text.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        text_scrollbar = ttk.Scrollbar(self.text_frame, orient=tk.VERTICAL, command=self.schedule_text.yview)
        self.schedule_text.configure(yscrollcommand=text_scrollbar.set)
        text_scrollbar.grid(row=0, column=1, sticky=(tk.N, tk.S))
        
        # Create makespan label
        self.makespan_label = ttk.Label(self.main_frame, text="")
        self.makespan_label.grid(row=5, column=0, pady=5)

        # Create timer label
        self.timer_label = ttk.Label(self.main_frame, text="")
        self.timer_label.grid(row=6, column=0, pady=5)
        
        # Configure grid weights
        self.main_frame.columnconfigure(0, weight=1)
        self.main_frame.rowconfigure(3, weight=1)
        self.main_frame.rowconfigure(4, weight=1)
        self.table_frame.columnconfigure(0, weight=1)
        self.table_frame.rowconfigure(0, weight=1)
        self.text_frame.columnconfigure(0, weight=1)
        self.text_frame.rowconfigure(0, weight=1)

    def time_to_minutes(self, time_str):
        """Convert time string to minutes since midnight for calendar"""
        if pd.isna(time_str) or not time_str:
            logging.warning(f"Invalid time string: {time_str}")
            return 0
        try:
            time_obj = datetime.strptime(str(time_str), "%H:%M:%S").time()
            return time_obj.hour * 60 + time_obj.minute
        except Exception as e:
            logging.error(f"Error converting time {time_str}: {e}")
            return 0

    def time_to_minutes_holiday(self, time_str):
        """Convert time string to minutes since midnight for holidays"""
        if pd.isna(time_str) or not time_str:
            logging.warning(f"Invalid holiday time string: {time_str}")
            return 0
        try:
            time_obj = datetime.strptime(str(time_str), "%H:%M").time()
            return time_obj.hour * 60 + time_obj.minute
        except Exception as e:
            logging.error(f"Error converting holiday time {time_str}: {e}")
            return 0

    def is_holiday_period(self, check_datetime, holiday, resource_id=None):
        """Check if a datetime falls within a holiday period for a resource or all resources"""
        holiday_date = datetime.strptime(holiday['date'], '%Y-%m-%d').date()
        if check_datetime.date() != holiday_date:
            return False

        if not holiday['resources']:  # General holiday
            if not holiday['start_time'] or not holiday['end_time']:
                return True  # Full-day holiday
            holiday_start = self.time_to_minutes_holiday(holiday['start_time'])
            holiday_end = self.time_to_minutes_holiday(holiday['end_time'])
            minutes_in_day = check_datetime.hour * 60 + check_datetime.minute
            return holiday_start <= minutes_in_day < holiday_end
        elif resource_id and resource_id in holiday['resources']:  # Resource-specific
            if not holiday['start_time'] or not holiday['end_time']:
                return True  # Full-day for specific resource
            holiday_start = self.time_to_minutes_holiday(holiday['start_time'])
            holiday_end = self.time_to_minutes_holiday(holiday['end_time'])
            minutes_in_day = check_datetime.hour * 60 + check_datetime.minute
            return holiday_start <= minutes_in_day < holiday_end

        return False

    def find_first_working_minute(self, start_date, working_hours, holidays):
        """Find the first working minute on or after start_date, respecting holidays"""
        current_date = start_date
        max_days = 7
        day_count = 0

        while day_count < max_days:
            weekday = current_date.isoweekday()
            start_minutes, end_minutes = working_hours.get(weekday, (0, 0))
            logging.debug(f"Checking {current_date} (weekday {weekday}): start={start_minutes}, end={end_minutes}")

            # Check for holidays
            holiday = holidays.get(current_date.strftime('%Y-%m-%d'))
            if holiday and not holiday['resources'] and not (holiday['start_time'] and holiday['end_time']):
                logging.debug(f"Skipping full-day holiday on {current_date}")
                current_date += timedelta(days=1)
                day_count += 1
                continue
            elif holiday and holiday['start_time'] and holiday['end_time']:
                holiday_start = self.time_to_minutes_holiday(holiday['start_time'])
                holiday_end = self.time_to_minutes_holiday(holiday['end_time'])
                if holiday_start < holiday_end and not holiday['resources']:
                    logging.debug(f"Partial holiday on {current_date}: {holiday_start}-{holiday_end} minutes")
                    start_minutes = max(start_minutes, holiday_end)
                if start_minutes >= end_minutes:
                    logging.debug(f"No working time after holiday on {current_date}")
                    current_date += timedelta(days=1)
                    day_count += 1
                    continue

            if start_minutes < end_minutes and start_minutes > 0:
                result = datetime.combine(current_date, datetime.min.time()) + timedelta(minutes=start_minutes)
                logging.debug(f"First working minute: {result}")
                return result
            else:
                logging.debug(f"Skipping non-working day {current_date} (weekday {weekday})")
                current_date += timedelta(days=1)
                day_count += 1

        logging.error(f"No working day found within {max_days} days from {start_date}")
        return datetime.combine(start_date, datetime.min.time())

    def minutes_to_datetime(self, minutes, start_date, working_hours, holidays, resource_id=None, duration=None):
        """Convert minutes to datetime, respecting working hours and holidays"""
        logging.debug(f"Converting {minutes} minutes from {start_date} with resource_id={resource_id}, duration={duration}")
        
        base_datetime = self.find_first_working_minute(start_date, working_hours, holidays)
        remaining_minutes = minutes
        current_date = base_datetime.date()
        max_days = 365
        day_count = 0

        while remaining_minutes > 0 and day_count < max_days:
            weekday = current_date.isoweekday()
            start_minutes, end_minutes = working_hours.get(weekday, (0, 0))
            logging.debug(f"Processing {current_date} (weekday {weekday}): start={start_minutes}, end={end_minutes}")

            if start_minutes >= end_minutes or start_minutes == 0:
                logging.debug(f"Skipping non-working day {current_date}")
                current_date += timedelta(days=1)
                day_count += 1
                continue

            # Check holidays
            holiday = holidays.get(current_date.strftime('%Y-%m-%d'))
            if holiday and not holiday['resources'] and not (holiday['start_time'] and holiday['end_time']):
                logging.debug(f"Skipping full-day general holiday on {current_date}")
                current_date += timedelta(days=1)
                day_count += 1
                continue
            elif holiday and holiday['start_time'] and holiday['end_time'] and not holiday['resources']:
                holiday_start = self.time_to_minutes_holiday(holiday['start_time'])
                holiday_end = self.time_to_minutes_holiday(holiday['end_time'])
                if holiday_start < holiday_end:
                    start_minutes = max(start_minutes, holiday_end)
                    if start_minutes >= end_minutes:
                        logging.debug(f"No working time after holiday on {current_date}")
                        current_date += timedelta(days=1)
                        day_count += 1
                        continue

            available_minutes = end_minutes - start_minutes
            if remaining_minutes <= available_minutes:
                minutes_into_day = start_minutes + remaining_minutes
                result = datetime.combine(current_date, datetime.min.time()) + timedelta(minutes=minutes_into_day)
                
                # Verify result isn't in a holiday for the resource
                if holiday and self.is_holiday_period(result, holiday, resource_id):
                    logging.debug(f"Result {result} falls in holiday, advancing to next day")
                    current_date += timedelta(days=1)
                    day_count += 1
                    continue

                logging.debug(f"Mapped {minutes} minutes to {result}")
                if duration is not None:
                    end_minutes = minutes + duration
                    end_datetime = self.minutes_to_datetime(end_minutes, start_date, working_hours, holidays, resource_id, duration=None)
                    return result, end_datetime
                return result

            remaining_minutes -= available_minutes
            current_date += timedelta(days=1)
            day_count += 1

        logging.error(f"Failed to map {minutes} minutes within {max_days} days from {start_date}")
        if duration is not None:
            return base_datetime, base_datetime
        return base_datetime

    def detect_predecessor_cycles(self, tasks_df):
        """Detect cyclic or self-referential predecessors using DFS"""
        graph = {row["task_number"]: row["predecessors"] if isinstance(row["predecessors"], list) else [] for _, row in tasks_df.iterrows()}
        visited = set()
        rec_stack = set()
        issues = []

        def dfs(task_id, path):
            if task_id in rec_stack:
                cycle = path[path.index(task_id):] + [task_id]
                issues.append(f"Cyclic predecessor chain: {' -> '.join(cycle)}")
                return
            if task_id in visited:
                return
            visited.add(task_id)
            rec_stack.add(task_id)

            predecessors = graph.get(task_id, [])
            if task_id in predecessors:
                issues.append(f"Task {task_id} has itself as a predecessor")
            for pred in predecessors:
                if pred in graph:
                    dfs(pred, path + [task_id])

            rec_stack.remove(task_id)

        for task_id in graph:
            if task_id not in visited:
                dfs(task_id, [task_id])

        return issues

    def generate_schedule(self):
        """Generate the schedule using or-tools with holidays"""
        try:
            schedule_start_time = time.time()
            logging.debug(f"Schedule generation started at: {schedule_start_time}")
            self.status_label.config(text="Fetching data...")
            self.root.update()
            
            # Fetch data
            data = fetch_data()
            if data is None:
                self.status_label.config(text="Error: Failed to fetch data")
                logging.error("Failed to fetch data")
                return
            
            # Get and validate start date
            start_date = self.date_entry.get_date()
            logging.debug(f"Selected start date: {start_date}")
            if start_date < datetime.now().date():
                logging.warning("Start date is in the past")
                self.status_label.config(text="Warning: Start date is in the past")
            
            # Prepare data
            jobs_df = data["jobs"]
            tasks_df = data["tasks"]
            resources_df = data["resources"]
            calendar_df = data["calendar"]
            holidays_df = data["holidays"]
            resource_mapping = data["resource_mapping"]
            resource_group_mapping = data["resource_group_mapping"]
            
            # Convert holidays to dictionary for faster lookup
            holidays = {row['date']: {
                'date': row['date'],
                'start_time': row['start_time'],
                'end_time': row['end_time'],
                'resources': row['resources']
            } for _, row in holidays_df.iterrows()}
            
            # Log sample data
            logging.debug(f"Tasks sample: {tasks_df[['task_number', 'setup_time', 'time_each']].head().to_dict()}")
            logging.debug(f"Jobs sample: {jobs_df[['job_number', 'quantity']].head().to_dict()}")
            logging.debug(f"Holidays: {holidays}")
            logging.debug(f"Calendar sample: {calendar_df[['weekday', 'start_time', 'end_time']].to_dict()}")
            
            # Validate data
            errors = []
            
            # Check for missing jobs
            for _, task in tasks_df.iterrows():
                if task["job_number"] not in jobs_df["job_number"].values:
                    errors.append(f"Task {task['task_number']} references non-existent job {task['job_number']}")
            
            # Check for invalid durations
            for _, task in tasks_df.iterrows():
                if task["completed"]:
                    continue
                job = jobs_df[jobs_df["job_number"] == task["job_number"]]
                if job.empty:
                    continue
                job = job.iloc[0]
                setup_time = task["setup_time"] if pd.notna(task["setup_time"]) else 0
                time_each = task["time_each"] if pd.notna(task["time_each"]) else 0
                quantity = job["quantity"] if pd.notna(job["quantity"]) else 0
                duration = setup_time + (quantity * time_each)
                if duration <= 0:
                    errors.append(f"Task {task['task_number']} has invalid duration {duration} (setup_time={setup_time}, time_each={time_each}, quantity={quantity})")
            
            # Check for invalid resources
            resource_ids = set(resources_df['id'])
            for _, task in tasks_df.iterrows():
                if task["completed"]:
                    continue
                resources = task["resources"] if isinstance(task["resources"], list) else []
                for res in resources:
                    if res not in resource_mapping and res not in resource_group_mapping:
                        errors.append(f"Task {task['task_number']} references non-existent resource or group {res}")
                    elif res in resource_group_mapping and not resource_group_mapping[res]:
                        errors.append(f"Task {task['task_number']} references empty resource group {res}")
            
            # Check for predecessor issues
            errors.extend(self.detect_predecessor_cycles(tasks_df))
            
            # Check for invalid promised dates
            for _, job in jobs_df.iterrows():
                promised_date = job["promised_date"]
                if pd.isna(promised_date):
                    errors.append(f"Job {job['job_number']} has no promised date")
                else:
                    try:
                        if isinstance(promised_date, pd.Timestamp):
                            promised_date = promised_date.strftime('%Y-%m-%d %H:%M:%S')
                        datetime.strptime(promised_date, '%Y-%m-%d %H:%M:%S')
                    except (ValueError, TypeError):
                        errors.append(f"Job {job['job_number']} has invalid promised_date format: {promised_date}")
            
            # Validate holidays
            for date_str, holiday in holidays.items():
                try:
                    holiday_date = datetime.strptime(date_str, '%Y-%m-%d').date()
                    if holiday_date < datetime.now().date():
                        errors.append(f"Holiday on {date_str} is in the past")
                except ValueError:
                    errors.append(f"Holiday has invalid date format: {date_str}")
                
                if holiday['start_time'] and holiday['end_time']:
                    start_min = self.time_to_minutes_holiday(holiday['start_time'])
                    end_min = self.time_to_minutes_holiday(holiday['end_time'])
                    if start_min >= end_min:
                        errors.append(f"Holiday on {date_str} has invalid time range: {holiday['start_time']} to {holiday['end_time']}")
                
                for res_id in holiday['resources']:
                    if res_id not in resource_ids:
                        errors.append(f"Holiday on {date_str} references non-existent resource ID {res_id}")
            
            # Report errors if any
            if errors:
                error_msg = "Cannot generate schedule due to data issues:\n" + "\n".join([f"- {e}" for e in errors[:5]])
                if len(errors) > 5:
                    error_msg += f"\n...and {len(errors) - 5} more issues (see scheduler.log)"
                self.status_label.config(text=error_msg)
                logging.error(f"Data validation failed: {errors}")
                return
            
            # Prepare working hours
            working_hours = {}
            for _, row in calendar_df.iterrows():
                day = row["weekday"]
                start_minutes = self.time_to_minutes(row["start_time"])
                end_minutes = self.time_to_minutes(row["end_time"])
                working_hours[day] = (start_minutes, end_minutes)
                logging.debug(f"Weekday {day}: start={start_minutes}, end={end_minutes}, start_time={row['start_time']}, end_time={row['end_time']}")
            
            # Validate working hours
            valid_hours = [(start, end) for start, end in working_hours.values() if start < end and start > 0]
            logging.debug(f"Valid working hours: {valid_hours}")
            if not valid_hours:
                self.status_label.config(text="Error: No valid working hours defined in calendar")
                logging.error(f"No valid working hours in calendar: {working_hours}")
                return
            
            self.status_label.config(text="Creating schedule model...")
            self.root.update()
            
            # Create CP-SAT model
            model = cp_model.CpModel()

            # Create variables
            task_vars = {}
            resource_vars = {}
            job_completion = {}
            total_rand_days_late = model.NewIntVar(0, 1000000000, 'total_rand_days_late')

            # Process tasks
            for _, task in tasks_df.iterrows():
                if task["completed"]:
                    continue
                
                job = jobs_df[jobs_df["job_number"] == task["job_number"]].iloc[0]
                if job["completed"] or job["blocked"]:
                    logging.debug(f"Skipping task {task['task_number']} for job {job['job_number']} (completed={job['completed']}, blocked={job['blocked']})")
                    continue
                
                task_id = task["task_number"]
                setup_time = task["setup_time"] if pd.notna(task["setup_time"]) else 0
                time_each = task["time_each"] if pd.notna(task["time_each"]) else 0
                quantity = job["quantity"] if pd.notna(job["quantity"]) else 0
                duration = int(setup_time + (quantity * time_each))
                if duration <= 0:
                    logging.error(f"Invalid duration {duration} for task {task_id}: setup_time={setup_time}, quantity={quantity}, time_each={time_each}")
                    continue
                logging.debug(f"Task {task_id}: duration={duration} minutes")
                
                # Create task variables
                start_var = model.NewIntVar(0, 1000000, f'start_{task_id}')
                end_var = model.NewIntVar(0, 1000000, f'end_{task_id}')
                task_vars[task_id] = (start_var, end_var, duration)
                
                # Add duration constraint
                model.Add(end_var == start_var + duration)
                logging.debug(f"Added duration constraint for task {task_id}: end = start + {duration}")
                
                # Track job completion
                job_id = job["job_number"]
                if job_id not in job_completion:
                    job_completion[job_id] = model.NewIntVar(0, 1000000, f'completion_{job_id}')
                model.Add(job_completion[job_id] >= end_var)
                
                # Process resources
                resources = task["resources"] if isinstance(task["resources"], list) else []
                if not resources:
                    logging.warning(f"No valid resources for task {task_id}")
                
                resource_vars[task_id] = []
                for res in resources:
                    if res in resource_mapping:
                        res_id = resource_mapping[res]
                        resource_vars[task_id].append((res, res_id, None))
                    elif res in resource_group_mapping:
                        group_resources = resource_group_mapping[res]
                        if group_resources:
                            selected_resource = model.NewIntVarFromDomain(
                                cp_model.Domain.FromValues(group_resources),
                                f'selected_{task_id}_{res}'
                            )
                            resource_vars[task_id].append((res, selected_resource, group_resources))

            # Add job lateness constraints
            for job_id in job_completion:
                job = jobs_df[jobs_df["job_number"] == job_id].iloc[0]
                price_each = job["price_each"] if pd.notna(job["price_each"]) else 0
                quantity = job["quantity"] if pd.notna(job["quantity"]) else 0
                promised_date = job["promised_date"]
                if isinstance(promised_date, pd.Timestamp):
                    promised_date = promised_date.strftime('%Y-%m-%d %H:%M:%S')
                promised_date = datetime.strptime(promised_date, '%Y-%m-%d %H:%M:%S').date()
                job_value = int(price_each * quantity * 100)
                promised_days = (promised_date - start_date).days
                
                completion_days = model.NewIntVar(0, 10000, f'completion_days_{job_id}')
                days_late = model.NewIntVar(0, 10000, f'days_late_{job_id}')
                rand_days_late = model.NewIntVar(0, 1000000000, f'rand_days_late_{job_id}')
                
                model.AddDivisionEquality(completion_days, job_completion[job_id], 1440)
                model.Add(days_late >= completion_days - promised_days)
                model.Add(days_late >= 0)
                model.AddMultiplicationEquality(rand_days_late, [days_late, model.NewConstant(job_value)])
                model.Add(total_rand_days_late >= rand_days_late)
                
                logging.debug(f"Job {job_id}: value={job_value/100}, promised_days={promised_days}")

            # Add predecessor constraints
            for _, task in tasks_df.iterrows():
                if task["completed"]:
                    continue
                
                task_id = task["task_number"]
                if task_id not in task_vars:
                    continue
                
                predecessors = task["predecessors"] if isinstance(task["predecessors"], list) else []
                for pred in predecessors:
                    if pred in task_vars:
                        model.Add(task_vars[task_id][0] >= task_vars[pred][1])
                        logging.debug(f"Added predecessor constraint: {task_id} starts after {pred} ends")

            # Add resource constraints
            resource_intervals = {}
            for task_id, resources in resource_vars.items():
                for res_name, res_var, group_resources in resources:
                    if group_resources is None:  # Direct resource assignment
                        res_id = res_var
                        if res_id not in resource_intervals:
                            resource_intervals[res_id] = []
                        interval = model.NewIntervalVar(
                            task_vars[task_id][0],
                            task_vars[task_id][2],
                            task_vars[task_id][1],
                            f'interval_{task_id}_{res_id}'
                        )
                        resource_intervals[res_id].append(interval)
                        logging.debug(f"Added interval for task {task_id} on resource {res_name} (ID {res_id})")
                    else:  # Resource group assignment
                        # Create a boolean variable for each possible resource
                        for possible_res_id in group_resources:
                            if possible_res_id not in resource_intervals:
                                resource_intervals[possible_res_id] = []
                            is_selected = model.NewBoolVar(f'is_{task_id}_{res_name}_{possible_res_id}')
                            # Link selection to resource variable
                            model.Add(res_var == possible_res_id).OnlyEnforceIf(is_selected)
                            model.Add(res_var != possible_res_id).OnlyEnforceIf(is_selected.Not())
                            # Create optional interval
                            interval = model.NewOptionalIntervalVar(
                                task_vars[task_id][0],
                                task_vars[task_id][2],
                                task_vars[task_id][1],
                                is_selected,
                                f'opt_interval_{task_id}_{possible_res_id}'
                            )
                            resource_intervals[possible_res_id].append(interval)
                            logging.debug(f"Added optional interval for task {task_id} on resource {possible_res_id} in group {res_name}")
                
                # Ensure exactly one resource is selected from the group
                if group_resources:
                    selection_bools = [model.NewBoolVar(f'select_{task_id}_{res_name}_{res_id}') 
                                     for res_id in group_resources]
                    for idx, res_id in enumerate(group_resources):
                        model.Add(res_var == res_id).OnlyEnforceIf(selection_bools[idx])
                    model.AddExactlyOne(selection_bools)
                    logging.debug(f"Ensured single resource selection for task {task_id} in group {res_name}")

            # Add holiday constraints for resource-specific holidays
            for date_str, holiday in holidays.items():
                holiday_date = datetime.strptime(date_str, '%Y-%m-%d').date()
                if holiday['resources']:  # Resource-specific holiday
                    start_min = 0
                    end_min = 24 * 60
                    if holiday['start_time'] and holiday['end_time']:
                        start_min = self.time_to_minutes_holiday(holiday['start_time'])
                        end_min = self.time_to_minutes_holiday(holiday['end_time'])
                        if start_min >= end_min:
                            logging.warning(f"Skipping invalid holiday time range on {date_str}")
                            continue
                    holiday_start_dt = datetime.combine(holiday_date, datetime.min.time()) + timedelta(minutes=start_min)
                    holiday_end_dt = datetime.combine(holiday_date, datetime.min.time()) + timedelta(minutes=end_min)
                    holiday_start_min = int((holiday_start_dt - datetime.combine(start_date, datetime.min.time())).total_seconds() / 60)
                    holiday_end_min = int((holiday_end_dt - datetime.combine(start_date, datetime.min.time())).total_seconds() / 60)
                    
                    for res_id in holiday['resources']:
                        if res_id in resource_intervals:
                            for task_id in task_vars:
                                start_var, end_var, duration = task_vars[task_id]
                                before_holiday = model.NewBoolVar(f'before_holiday_{task_id}_{res_id}')
                                after_holiday = model.NewBoolVar(f'after_holiday_{task_id}_{res_id}')
                                model.Add(start_var + duration <= holiday_start_min).OnlyEnforceIf(before_holiday)
                                model.Add(start_var >= holiday_end_min).OnlyEnforceIf(after_holiday)
                                model.AddBoolOr([before_holiday, after_holiday])

            # Add no-overlap constraints
            for res_id, intervals in resource_intervals.items():
                if intervals:
                    model.AddNoOverlap(intervals)

            # Set objective
            model.Minimize(total_rand_days_late)
            
            self.status_label.config(text="Solving schedule...")
            self.root.update()
            
            # Solve
            solver = cp_model.CpSolver()
            solver.parameters.max_time_in_seconds = 120.0
            solver.parameters.log_search_progress = True
            status = solver.Solve(model)
            
            if status not in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
                error_msg = "No feasible schedule found. Possible causes:\n"
                model_no_resource = cp_model.CpModel()
                task_vars_no_res = {}
                for task_id, (start_var, end_var, duration) in task_vars.items():
                    start_var_no_res = model_no_resource.NewIntVar(0, 1000000, f'start_{task_id}')
                    end_var_no_res = model_no_resource.NewIntVar(0, 1000000, f'end_{task_id}')
                    task_vars_no_res[task_id] = (start_var_no_res, end_var_no_res, duration)
                    model_no_resource.Add(end_var_no_res == start_var_no_res + duration)
                for task_id in task_vars_no_res:
                    predecessors = tasks_df[tasks_df["task_number"] == task_id]["predecessors"].iloc[0]
                    predecessors = predecessors if isinstance(predecessors, list) else []
                    for pred in predecessors:
                        if pred in task_vars_no_res:
                            model_no_resource.Add(task_vars_no_res[task_id][0] >= task_vars_no_res[pred][1])
                solver_no_res = cp_model.CpSolver()
                status_no_res = solver_no_res.Solve(model_no_resource)
                if status_no_res in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
                    error_msg += "- Resource conflicts or holiday restrictions prevent scheduling.\n"
                else:
                    error_msg += "- Predecessor constraints or task durations prevent a feasible schedule.\n"
                error_msg += "Check scheduler.log for details."
                self.status_label.config(text=error_msg)
                logging.error(f"Solver status: {status}. {error_msg}")
                return
            
            # Process solution
            self.schedule = []
            self.makespan = None
            logging.debug(f"Total rand-days late: {solver.Value(total_rand_days_late)/100} ZAR-days")
            
            max_end_time = None
            for task_id, (start_var, end_var, duration) in task_vars.items():
                start_time = solver.Value(start_var)
                end_time = solver.Value(end_var)
                
                if start_time == 0:
                    start_time = 1
                    end_time = start_time + duration
                    logging.debug(f"Adjusted task {task_id}: start=0 to start=1, end={end_time}, duration={duration}")
                
                logging.debug(f"Task {task_id}: start={start_time}, end={end_time}, duration={duration}")
                
                # Convert to datetime
                resources = resource_vars.get(task_id, [])
                selected_res_id = None
                for res_name, res_var, group_resources in resources:
                    if group_resources is None:
                        selected_res_id = res_var
                    else:
                        selected_res_id = solver.Value(res_var)
                    break  # Use first resource for datetime mapping
                
                start_datetime, end_datetime = self.minutes_to_datetime(
                    start_time, start_date, working_hours, holidays, resource_id=selected_res_id, duration=duration
                )
                
                if max_end_time is None or end_datetime > max_end_time:
                    max_end_time = end_datetime
                
                # Get resources
                resources_list = []
                for res_name, res_var, group_resources in resources:
                    if group_resources is None:
                        res_id = res_var
                        resources_list.append(res_name)
                    else:
                        res_id = solver.Value(res_var)
                        resources_list.append(next(k for k, v in resource_mapping.items() if v == res_id))
                
                self.schedule.append({
                    "task_number": task_id,
                    "start_time": start_datetime,
                    "end_time": end_datetime,
                    "resources": ", ".join(resources_list),
                    "duration": duration,
                    "start_minute": start_time,
                    "end_minute": end_time
                })
            
            # Compute datetime-based makespan
            if max_end_time:
                base_datetime = self.find_first_working_minute(start_date, working_hours, holidays)
                makespan_seconds = (max_end_time - base_datetime).total_seconds()
                makespan_days = makespan_seconds / (60 * 60 * 24)
                self.makespan = int(makespan_days * 24 * 60)
                logging.debug(f"Datetime-based makespan: {self.makespan} minutes ({makespan_days:.2f} days)")
            
            # Save to database
            try:
                with engine.connect() as conn:
                    conn.execute(sa.text("DELETE FROM public.schedule;"))
                    for entry in self.schedule:
                        query = sa.text("""
                            INSERT INTO public.schedule (task_number, start_time, end_time, resources_used)
                            VALUES (:task_number, :start_time, :end_time, :resources_used);
                        """)
                        conn.execute(query, {
                            "task_number": entry["task_number"],
                            "start_time": str(entry["start_time"]),
                            "end_time": str(entry["end_time"]),
                            "resources_used": entry["resources"]
                        })
                    conn.commit()
            except Exception as e:
                logging.error(f"Error saving schedule to database: {e}")
                self.status_label.config(text=f"Error saving schedule: {e}")
                return
            
            # Update GUI
            self.update_schedule_display()
            self.status_label.config(text="Schedule generated successfully!")
            elapsed_time = time.time() - schedule_start_time
            logging.debug(f"Schedule generation took: {elapsed_time:.2f} seconds")
            self.timer_label.config(text=f"Schedule Generation Time: {elapsed_time:.2f} seconds")
            
        except Exception as e:
            logging.error(f"Error generating schedule: {e}")
            self.status_label.config(text=f"Error: {str(e)}")

    def update_schedule_display(self):
        """Update the schedule display in the GUI"""
        # Clear existing items
        for item in self.tree.get_children():
            self.tree.delete(item)
        
        # Clear text widget
        self.schedule_text.delete(1.0, tk.END)
        
        # Add header to text widget
        header = f"{'Task':<20} {'Start Time':<25} {'End Time':<25} {'Resources':<30} {'Duration':<10} {'Start Min':<10} {'End Min':<10}\n"
        header += "-" * 140 + "\n"
        self.schedule_text.insert(tk.END, header)
        
        # Add schedule items
        for entry in self.schedule:
            task = entry["task_number"]
            start_time = entry["start_time"].strftime("%Y-%m-%d %H:%M:%S")
            end_time = entry["end_time"].strftime("%Y-%m-%d %H:%M:%S")
            resources = entry["resources"]
            duration = entry["duration"]
            start_minute = entry["start_minute"]
            end_minute = entry["end_minute"]
            
            # Add to treeview
            self.tree.insert("", tk.END, values=(task, start_time, end_time, resources, duration, start_minute, end_minute))
            
            # Add to text widget
            line = f"{task:<20} {start_time:<25} {end_time:<25} {resources:<30} {duration:<10} {start_minute:<10} {end_minute:<10}\n"
            self.schedule_text.insert(tk.END, line)
        
        # Update makespan label
        if self.makespan is not None and self.schedule:
            max_end_time = max(entry["end_time"] for entry in self.schedule)
            min_start_time = min(entry["start_time"] for entry in self.schedule)
            hours = self.makespan // 60
            minutes = self.makespan % 60
            days = (max_end_time - min_start_time).total_seconds() / (60 * 60 * 24)
            self.makespan_label.config(
                text=f"Total Makespan: {hours} hours and {minutes} minutes ({days:.2f} days)"
            )

def main():
    root = tk.Tk()
    app = SchedulerApp(root)
    root.mainloop()

if __name__ == "__main__":
    main()