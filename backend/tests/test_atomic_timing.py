"""Timing tests for atomic() using real metadata.json.

This test uses a copy of the actual production metadata.json to verify
that concurrent atomic() operations complete quickly and don't block.
"""

import asyncio
import json
import shutil
import time
from pathlib import Path

import pytest

# Real metadata path
REAL_METADATA = Path(__file__).parent.parent.parent / "generated_images" / "metadata.json"

pytestmark = pytest.mark.anyio


class TestAtomicTimingWithRealData:
    """Test atomic() timing with real metadata.json."""

    @pytest.fixture
    def real_metadata_copy(self, tmp_path):
        """Copy real metadata.json to temp directory for testing."""
        if not REAL_METADATA.exists():
            pytest.skip("No real metadata.json found")

        images_dir = tmp_path / "generated_images"
        images_dir.mkdir()
        metadata_path = images_dir / "metadata.json"

        # Copy real metadata
        shutil.copy(REAL_METADATA, metadata_path)

        return metadata_path, images_dir

    async def test_atomic_phase3_timing_concurrent(self, real_metadata_copy):
        """Measure Phase 3 timing with concurrent requests on real data.

        Simulates 10 concept generations completing at nearly the same time,
        all trying to write to metadata.
        """
        from metadata_manager import MetadataManager

        metadata_path, images_dir = real_metadata_copy
        manager = MetadataManager(metadata_path, images_dir)

        # Get file size for context
        file_size = metadata_path.stat().st_size
        print(f"\n📁 Testing with metadata.json: {file_size / 1024:.1f} KB")

        timings = []
        num_concurrent = 10

        async def simulate_concept_write(worker_id: int):
            """Simulate a concept generation's Phase 3 (atomic write)."""
            # Record when we START trying to acquire lock
            wait_start = time.perf_counter()

            async with manager.atomic() as data:
                # Lock acquired - record time
                lock_acquired = time.perf_counter()
                wait_time = (lock_acquired - wait_start) * 1000  # ms

                # Simulate updating a token (like concept generation does)
                if "tokens" not in data:
                    data["tokens"] = []

                # Add a test token
                data["tokens"].append({
                    "id": f"timing-test-{worker_id}",
                    "name": f"Timing Test {worker_id}",
                    "concept_image_path": f"concept-test-{worker_id}.jpg",
                })

                # Record time BEFORE save (save happens on context exit)
                work_done = time.perf_counter()

            # Lock released, save complete
            done = time.perf_counter()
            write_time = (done - lock_acquired) * 1000  # ms
            total_time = (done - wait_start) * 1000  # ms

            return {
                "worker_id": worker_id,
                "wait_time_ms": wait_time,
                "write_time_ms": write_time,
                "total_time_ms": total_time,
            }

        # Launch all workers concurrently (simulating 10 concept generations
        # that all complete their Gemini API calls at the same time)
        print(f"🚀 Launching {num_concurrent} concurrent atomic() operations...")

        start = time.perf_counter()
        results = await asyncio.gather(*[
            simulate_concept_write(i) for i in range(num_concurrent)
        ])
        total_elapsed = (time.perf_counter() - start) * 1000

        # Analyze results
        print(f"\n📊 Results ({num_concurrent} concurrent writers):")
        print("-" * 60)

        wait_times = [r["wait_time_ms"] for r in results]
        write_times = [r["write_time_ms"] for r in results]
        total_times = [r["total_time_ms"] for r in results]

        print(f"Lock wait time:  min={min(wait_times):.1f}ms, "
              f"max={max(wait_times):.1f}ms, avg={sum(wait_times)/len(wait_times):.1f}ms")
        print(f"Write time:      min={min(write_times):.1f}ms, "
              f"max={max(write_times):.1f}ms, avg={sum(write_times)/len(write_times):.1f}ms")
        print(f"Total time:      min={min(total_times):.1f}ms, "
              f"max={max(total_times):.1f}ms, avg={sum(total_times)/len(total_times):.1f}ms")
        print(f"\nWall clock time for all {num_concurrent} operations: {total_elapsed:.1f}ms")

        # Assertions - Phase 3 should be fast
        # Even the slowest writer (who waits for all others) should complete in <1s
        assert max(total_times) < 1000, f"Slowest writer took {max(total_times):.0f}ms (>1s)"

        # Each individual write (holding lock) should be <100ms
        assert max(write_times) < 100, f"Slowest write took {max(write_times):.0f}ms (>100ms)"

        # Verify all writes succeeded
        with open(metadata_path) as f:
            final_data = json.load(f)
        test_tokens = [t for t in final_data.get("tokens", []) if t["id"].startswith("timing-test-")]
        assert len(test_tokens) == num_concurrent, f"Expected {num_concurrent} test tokens, got {len(test_tokens)}"

        print(f"\n✅ All {num_concurrent} tokens written successfully!")

    async def test_event_loop_not_blocked_during_lock_wait(self, real_metadata_copy):
        """Verify event loop stays responsive while waiting for lock.

        This is the key test - even if one coroutine holds the lock,
        other async work should proceed normally.
        """
        from metadata_manager import MetadataManager

        metadata_path, images_dir = real_metadata_copy
        manager = MetadataManager(metadata_path, images_dir)

        heartbeat_count = 0
        heartbeat_times = []

        async def heartbeat():
            """Simulates other async work (like HTTP keepalive)."""
            nonlocal heartbeat_count
            for _ in range(20):
                await asyncio.sleep(0.01)  # 10ms heartbeat
                heartbeat_count += 1
                heartbeat_times.append(time.perf_counter())

        async def slow_lock_holder():
            """Holds the lock for 100ms to simulate slow I/O."""
            async with manager.atomic() as data:
                # Hold lock while doing "slow" work
                await asyncio.sleep(0.1)  # 100ms
                data["tokens"] = data.get("tokens", [])
                data["tokens"].append({"id": "slow-holder", "name": "Slow"})

        async def lock_waiter():
            """Tries to acquire lock while slow_holder has it."""
            await asyncio.sleep(0.02)  # Start slightly after slow_holder
            async with manager.atomic() as data:
                data["tokens"].append({"id": "waiter", "name": "Waiter"})

        # Run all three concurrently
        print("\n🔄 Testing event loop responsiveness during lock contention...")
        start = time.perf_counter()

        await asyncio.gather(
            heartbeat(),
            slow_lock_holder(),
            lock_waiter(),
        )

        elapsed = (time.perf_counter() - start) * 1000

        print(f"   Heartbeats completed: {heartbeat_count}/20")
        print(f"   Total time: {elapsed:.1f}ms")

        # If event loop was blocked, heartbeats would be delayed
        # We expect most heartbeats to complete
        assert heartbeat_count >= 15, (
            f"Only {heartbeat_count} heartbeats - event loop was blocked!"
        )

        # Check heartbeat regularity (should be ~10ms apart if not blocked)
        if len(heartbeat_times) >= 2:
            intervals = [
                (heartbeat_times[i] - heartbeat_times[i-1]) * 1000
                for i in range(1, len(heartbeat_times))
            ]
            max_interval = max(intervals)
            print(f"   Max heartbeat interval: {max_interval:.1f}ms (should be ~10-20ms)")

            # Allow some slack, but a blocked event loop would show 100ms+ gaps
            assert max_interval < 50, f"Event loop blocked for {max_interval:.0f}ms"

        print("✅ Event loop remained responsive!")
