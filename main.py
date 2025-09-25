import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / 'src'))

from float_translator.app import run

if __name__ == '__main__':
    run()