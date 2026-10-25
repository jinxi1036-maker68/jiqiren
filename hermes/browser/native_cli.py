"""Compatibility for both stdin-only and legacy 'browser-use exec' callers.
The current installed Hermes sends stdin without 'exec'. No model/identity logic.
"""
import sys


def normalize_args(args):
    if args == []:
        return []
    if args == ["exec"]:
        return []
    if args in (["skill"], ["--version"], ["--help"]):
        return args
    raise ValueError("Only stdin, exec(stdin), skill, --version and --help are allowed")


def main():
    try:
        args = normalize_args(sys.argv[1:])
    except ValueError as e:
        print(str(e), file=sys.stderr)
        return 2
    sys.argv = ["browser-use", *args]
    from browser_use.cli import main as cli_main
    return cli_main()


if __name__ == "__main__":
    raise SystemExit(main())
