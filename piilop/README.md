# Proboscis II - Legend of Proboscis

This is a test library offering the following features:

* the ability to track and record resources created by tests
* the ability to sort tests so that they run as optimally as possible

## Motivation

Say you need to test a system which can provision a resource types A, B, and C. Resources of type B requires a parent resource A, and resources of type C require B but can live past B.

Using this allows you to write a test for resource C that just says "at the start, get me access to an instance of B." You can then using the sorting capabilities to ensure the tests for A and then B run before C, meaning it's likely that they'll create instances of B to be used by the tests for C. If you have tests that delete resources of type B, you can schedule them to run after their dependents - meaning the tests to delete B will happen after you're done using instances of B. Similarly tests to delete A will happen after B is finished.

The traditional alternative to this approach is writing "fixtures" that would create and delete instances of B just for the C tests.

## Features


