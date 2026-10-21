"""Checks the vdb-maintainer policy in maintainer.yaml with IAM's policy simulator.

Each case is an action the maintainer should or shouldn't be able to do day to
day. It reads the policy from the template, not from AWS, so it runs before a
deploy. It only reads: simulate-custom-policy changes nothing.

    python3 services/fablazing/infra/check_maintainer_policy.py

It needs PyYAML and the AWS CLI signed in with `aws login --profile vdb`.
"""

import json
import os
import re
import subprocess
import sys

import yaml

ACCOUNT = "495599764170"
REGION = "eu-west-1"
HERE = os.path.dirname(os.path.abspath(__file__))

FN = f"arn:aws:lambda:{REGION}:{ACCOUNT}:function:vdb-fablazing-ingest"
LOGS = f"arn:aws:logs:{REGION}:{ACCOUNT}:log-group:/aws/lambda/vdb-fablazing-ingest"
RAW = f"arn:aws:s3:::vdb-fablazing-raw-{ACCOUNT}"
ARTIFACTS = f"arn:aws:s3:::vdb-fablazing-artifacts-{ACCOUNT}"
PARAM = f"arn:aws:ssm:{REGION}:{ACCOUNT}:parameter/vdb/fablazing/api-key"
STACK = f"arn:aws:cloudformation:{REGION}:{ACCOUNT}:stack/vdb-fablazing/abc"
BOOTSTRAP = f"arn:aws:cloudformation:{REGION}:{ACCOUNT}:stack/vdb-fablazing-bootstrap/abc"
CFN_ROLE = f"arn:aws:iam::{ACCOUNT}:role/vdb-fablazing-cfn-exec"
ADMIN_ROLE = f"arn:aws:iam::{ACCOUNT}:role/vdb-admin"
ME = f"arn:aws:iam::{ACCOUNT}:user/viserai.decks"


def ctx(key, value, kind="string"):
    return {"ContextKeyName": key, "ContextKeyValues": [value], "ContextKeyType": kind}


# (expected, action, resource, context entries)
CASES = [
    # The ingest: rerun a day, read its logs, alarm and schedule.
    ("allowed", "lambda:InvokeFunction", FN, []),
    ("allowed", "lambda:GetFunction", FN, []),
    ("allowed", "logs:FilterLogEvents", LOGS, []),
    ("allowed", "logs:StartLiveTail", LOGS, []),
    ("allowed", "logs:StartQuery", LOGS, []),
    ("allowed", "logs:GetQueryResults", "*", []),
    ("allowed", "cloudwatch:DescribeAlarms", "*", []),
    ("allowed", "cloudwatch:GetMetricData", "*", []),
    ("allowed", "scheduler:GetSchedule", f"arn:aws:scheduler:{REGION}:{ACCOUNT}:schedule/default/vdb-fablazing-daily", []),
    # Raw records: read, never change.
    ("allowed", "s3:GetObject", f"{RAW}/raw/date=2026-10-20/format=0.ndjson.gz", []),
    ("allowed", "s3:ListBucket", RAW, []),
    ("implicitDeny", "s3:PutObject", f"{RAW}/raw/x", []),
    ("implicitDeny", "s3:DeleteObject", f"{RAW}/raw/x", []),
    # Secrets under /vdb/fablazing/ only.
    ("allowed", "ssm:GetParameter", PARAM, []),
    ("allowed", "ssm:PutParameter", PARAM, []),
    ("allowed", "ssm:GetParametersByPath", f"arn:aws:ssm:{REGION}:{ACCOUNT}:parameter/vdb/fablazing", []),
    ("implicitDeny", "ssm:PutParameter", f"arn:aws:ssm:{REGION}:{ACCOUNT}:parameter/other", []),
    ("implicitDeny", "ssm:DeleteParameter", PARAM, []),
    # Stacks: read all; change the app stack only through the CloudFormation role.
    ("allowed", "cloudformation:DescribeStacks", BOOTSTRAP, []),
    ("allowed", "cloudformation:DescribeStackEvents", STACK, []),
    ("allowed", "cloudformation:CreateChangeSet", STACK, [ctx("cloudformation:RoleArn", CFN_ROLE)]),
    ("implicitDeny", "cloudformation:CreateChangeSet", STACK, []),
    ("implicitDeny", "cloudformation:CreateChangeSet", BOOTSTRAP, [ctx("cloudformation:RoleArn", CFN_ROLE)]),
    ("allowed", "cloudformation:ExecuteChangeSet", STACK, []),
    ("implicitDeny", "cloudformation:DeleteStack", STACK, []),
    ("implicitDeny", "cloudformation:UpdateStack", BOOTSTRAP, []),
    ("allowed", "iam:PassRole", CFN_ROLE, [ctx("iam:PassedToService", "cloudformation.amazonaws.com")]),
    ("implicitDeny", "iam:PassRole", CFN_ROLE, [ctx("iam:PassedToService", "lambda.amazonaws.com")]),
    ("allowed", "s3:PutObject", f"{ARTIFACTS}/vdb-fablazing/x", []),
    # The way back to admin, and nothing else in IAM beyond your own login.
    ("allowed", "sts:AssumeRole", ADMIN_ROLE, []),
    ("allowed", "iam:ChangePassword", ME, [ctx("aws:username", "viserai.decks")]),
    ("implicitDeny", "iam:ChangePassword", f"arn:aws:iam::{ACCOUNT}:user/someone", [ctx("aws:username", "viserai.decks")]),
    ("implicitDeny", "iam:CreateAccessKey", ME, [ctx("aws:username", "viserai.decks")]),
    ("implicitDeny", "iam:AttachUserPolicy", ME, []),
    ("implicitDeny", "iam:AddUserToGroup", f"arn:aws:iam::{ACCOUNT}:group/admins", []),
    ("implicitDeny", "iam:PutRolePolicy", CFN_ROLE, []),
    ("implicitDeny", "lambda:UpdateFunctionCode", FN, []),
]


class Loader(yaml.SafeLoader):
    pass


for tag in ("!Sub", "!Ref", "!GetAtt"):
    Loader.add_constructor(tag, lambda loader, node: {"__tag": node.tag, "value": loader.construct_scalar(node)})


def render(value, policies):
    """Fills the template's !Sub and !Ref with this account's values."""
    if isinstance(value, dict) and "__tag" in value:
        text = value["value"]
        if value["__tag"] in ("!Ref", "!GetAtt"):
            return policies[text.split(".")[0]]
        text = text.replace("${AWS::AccountId}", ACCOUNT).replace("${AWS::Region}", REGION)
        text = re.sub(r"\$\{(\w+)\}", lambda m: policies[m.group(1)], text)
        return text.replace("${!", "${")
    if isinstance(value, dict):
        return {k: render(v, policies) for k, v in value.items()}
    if isinstance(value, list):
        return [render(v, policies) for v in value]
    return value


def main():
    with open(os.path.join(HERE, "maintainer.yaml")) as f:
        template = yaml.load(f, Loader=Loader)
    resource = template["Resources"]["MaintainerPolicy"]
    document = render(resource["Properties"]["PolicyDocument"], {"AdminRole": ADMIN_ROLE})

    failures = 0
    for expected, action, arn, context in CASES:
        args = [
            "aws", "iam", "simulate-custom-policy", "--profile", "vdb", "--region", REGION,
            "--policy-input-list", json.dumps(document),
            "--action-names", action, "--resource-arns", arn,
            "--query", "EvaluationResults[0].EvalDecision", "--output", "text",
        ]
        if context:
            args += ["--context-entries", json.dumps(context)]
        got = subprocess.run(args, capture_output=True, text=True, check=True).stdout.strip()
        ok = got == expected
        failures += not ok
        print(f"{'ok  ' if ok else 'FAIL'} {action} {arn.split(':')[-1]}: {got}, want {expected}")
    print(f"{len(CASES) - failures}/{len(CASES)} as expected")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
